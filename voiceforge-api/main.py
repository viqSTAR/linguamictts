from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import io
import re
import numpy as np
from datetime import datetime

import os
import gguf_orpheus as _gguf_orpheus_module
from gguf_orpheus import generate_speech_from_api, AVAILABLE_VOICES, SAMPLE_RATE
from fastapi import UploadFile, File
import tempfile

# ---------------- STT GLOBALS ---------------- #
try:
    import faster_whisper
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"
    whisper_model = faster_whisper.WhisperModel("base", device=device, compute_type=compute_type)
    print(f"[Whisper] Loaded base model on {device} ({compute_type})")
except Exception as e:
    print(f"[Whisper] Error loading model: {e}")
    whisper_model = None


# Fix: Override hardcoded 127.0.0.1 so Docker can reach LM Studio on the host via host.docker.internal
_lm_host = os.getenv("LM_STUDIO_HOST", "127.0.0.1")
_lm_port = os.getenv("LM_STUDIO_PORT", "1234")
_gguf_orpheus_module.API_URL = f"http://{_lm_host}:{_lm_port}/v1/completions"
print(f"[LM Studio] API_URL set to: {_gguf_orpheus_module.API_URL}")


app = FastAPI()

# ---------------- CONFIG ---------------- #

# Neutral defaults — balanced for natural, conversational speech
# Lower rep_penalty (1.10 = official Orpheus minimum) — higher values make the
# model speak faster which causes word-skipping (e.g. "language" in "language barriers")
DEFAULT_TEMPERATURE = 0.55
DEFAULT_TOP_P = 0.90
# 1.10 is the minimum required for stable generation per official Orpheus docs.
# Raising above this makes speech faster but also causes word-skipping on longer sentences.
DEFAULT_REP_PENALTY = 1.10

# Tone presets — each tone has a distinct enough parameter spread so they
# genuinely *sound* different from each other and from neutral.
# Key axes:
#   temperature  → expressiveness / prosody variation (higher = more dramatic)
#   top_p        → token diversity (higher = more word choices, richer delivery)
#   rep_penalty  → avoids flat repetition; higher = more varied pronunciation
#   speed        → pace (no pitch correction — keep within 0.85–1.15 range)
TONE_PRESETS = {
    # Measured, warm, controlled — a bedtime-story or meditation voice
    "calm": {"temperature": 0.42, "top_p": 0.82, "repetition_penalty": 1.20, "speed": 0.93},
    # Intimate, breathy, unhurried — close-mic, almost whispery
    "romantic": {"temperature": 0.38, "top_p": 0.78, "repetition_penalty": 1.20, "speed": 0.91},
    # Wide dynamic range — the voice rises and falls like a seasoned narrator
    "storytelling": {"temperature": 0.68, "top_p": 0.90, "repetition_penalty": 1.15, "speed": 0.97},
    # Slow, deliberate, calculated — creeping dread, barely above a whisper
    "horror": {"temperature": 0.35, "top_p": 0.72, "repetition_penalty": 1.28, "speed": 0.86},
    # Loud, sharp, intense — clipped words, punchy delivery
    # rep_penalty raised to 1.12 (was 1.05) to stop repeated phrases even in angry tone
    "angry": {"temperature": 0.85, "top_p": 0.95, "repetition_penalty": 1.12, "speed": 1.08},
    # Confident, upbeat, driving — like a movie trailer narrator
    "adventurous": {"temperature": 0.72, "top_p": 0.90, "repetition_penalty": 1.12, "speed": 1.07},
    # Energetic, rapid, almost breathless — maximum enthusiasm
    "excited": {"temperature": 0.90, "top_p": 0.97, "repetition_penalty": 1.12, "speed": 1.14},
    # Heavy, slow, flat — grief-weighted delivery
    "sad": {"temperature": 0.40, "top_p": 0.80, "repetition_penalty": 1.22, "speed": 0.90},
    # Playful, quick, variable — comedic timing with bouncy rhythm
    "funny": {"temperature": 0.80, "top_p": 0.93, "repetition_penalty": 1.12, "speed": 1.05},
}

# ---------------- EMOTION TAG CONSTANTS ---------------- #

# These are the ONLY 8 emotion tags the Orpheus model was trained on.
# Source: gguf_orpheus.py list_available_voices() and Canopy Labs model card.
# Any other tag (e.g. <giggle>, <whisper>) is NOT in the model vocab and will
# produce undefined acoustic output — usually whatever the model guesses nearest.
VALID_ORPHEUS_EMOTIONS = frozenset([
    "laugh", "chuckle", "sigh", "cough", "sniffle", "groan", "yawn", "gasp"
])

# Pre-compiled regex matching any <word> tag in text
_EMOTION_TAG_RE = re.compile(r'<(\w+)>')


def sanitize_emotion_tags(text: str) -> str:
    """Strip any emotion-style tags that are NOT in the official Orpheus vocab.

    Valid tags are left as-is.  Unknown tags are removed rather than kept,
    because the model will misinterpret them and usually produce a gasp or
    clipped noise — exactly the bug the user reported with <giggle>.

    Examples:
        'I am the Goat <laugh>'      → 'I am the Goat <laugh>'  (unchanged)
        'Hello <giggle> world'       → 'Hello  world'            (stripped)
        '<whisper>Secret</whisper>'  → 'Secret'                  (stripped)
    """
    def _keep_or_strip(m: re.Match) -> str:
        tag_name = m.group(1).lower()
        return m.group(0) if tag_name in VALID_ORPHEUS_EMOTIONS else ''

    cleaned = _EMOTION_TAG_RE.sub(_keep_or_strip, text)
    # Collapse any double-spaces left by stripped tags
    return re.sub(r'  +', ' ', cleaned).strip()


# ---------------- UTIL ---------------- #


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "tara"
    tone: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    repetition_penalty: Optional[float] = None
    speed: Optional[float] = None


def split_text(text, max_chars=300):
    """Split text into chunks at natural sentence boundaries.

    Why this matters for TTS quality:
    - Splitting mid-sentence and adding a trailing comma makes Orpheus pause unnaturally
      at the chunk boundary, even though no pause exists in the original text.
    - Emotion tags work best when they have full sentence context on both sides.
      Mid-chunk emotion tags or emotion tags at the very end of a chunk misfire.
    - Complete sentences give the model coherent semantic context, which prevents
      speed jitter and the repetition bug (model loses its place in fragments).

    Strategy:
    1. Split at real sentence endings: . ? ! followed by whitespace
    2. If a sentence is still very long (>max_chars), split at comma boundaries
    3. NEVER add artificial trailing punctuation — the model inserts pauses there
    """
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    # Step 1: split at real sentence boundaries (. ? ! followed by space or end-of-string)
    raw_sentences = re.split(r'(?<=[.?!])\s+', text)



    chunks = []
    for sentence in raw_sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if len(sentence) <= max_chars:
            # Whole sentence fits — keep it intact for smooth, natural delivery
            chunks.append(sentence)
        else:
            # Step 2: long sentence — split at comma boundaries
            # Keeps emotion tags attached to the clause they precede
            parts = re.split(r',\s+', sentence)
            current = ''
            for part in parts:
                candidate = (current + ', ' + part) if current else part
                if current and len(candidate) > max_chars:
                    chunks.append(current)
                    current = part
                else:
                    current = candidate
            if current.strip():
                chunks.append(current.strip())

    # Step 3: merge chunks that are too short for Orpheus to generate meaningful audio.
    # The model needs at least 28 token frames to produce any output — very short fragments
    # (e.g. a lone emotion tag, a one-word sentence) produce silence instead.
    MIN_CHUNK_CHARS = 30
    merged: list[str] = []
    for chunk in chunks:
        if merged and len(chunk) < MIN_CHUNK_CHARS:
            # Attach to previous chunk — they belong to the same breath group anyway
            merged[-1] = merged[-1] + ' ' + chunk
        else:
            merged.append(chunk)

    return [c for c in merged if c.strip()]


def audio_to_pcm(audio):
    if isinstance(audio, bytes):
        return audio
    if isinstance(audio, list) and len(audio) > 0 and isinstance(audio[0], bytes):
        return b"".join(audio)
    return np.asarray(audio, dtype=np.int16).tobytes()


def pcm_to_wav(pcm_bytes):
    import wave
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm_bytes)
    buf.seek(0)
    return buf.read()


def apply_speed(pcm_bytes, speed):
    """Resample PCM audio to change playback speed.
    Uses scipy's polyphase filter (resample_poly) which produces significantly
    less aliasing than numpy linear interpolation — better quality at the same cost.
    Neutral tone always gets speed=1.0 so this function is skipped entirely.
    """
    if not speed or abs(speed - 1.0) < 0.005:
        return pcm_bytes

    from scipy.signal import resample_poly
    from math import gcd

    samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)

    # Express speed as a rational fraction so resample_poly can use integer up/down factors.
    # output_length = input_length / speed  →  up/down = 1/speed
    # e.g. speed=1.08 → up=125, down=135 (after GCD reduction)
    precision = 1000
    up = int(round(precision / speed))
    down = precision
    g = gcd(up, down)
    up //= g
    down //= g

    resampled = resample_poly(samples, up, down).astype(np.int16)
    return resampled.tobytes()


# ---------------- CORE ---------------- #

def generate_tts_stream(text, voice, temp, top_p, rep_pen, speed):

    chunks = split_text(text)

    import struct
    import concurrent.futures

    def create_wav_header(sample_rate=SAMPLE_RATE, channels=1, sampwidth=2):
        header = b"RIFF\xff\xff\xff\xffWAVEfmt \x10\x00\x00\x00\x01\x00"
        header += struct.pack("<H", channels)
        header += struct.pack("<I", sample_rate)
        header += struct.pack("<I", sample_rate * channels * sampwidth)
        header += struct.pack("<H", channels * sampwidth)
        header += struct.pack("<H", sampwidth * 8)
        header += b"data\xff\xff\xff\xff"
        return header

    yield create_wav_header()

    def _generate_chunk(chunk: str) -> bytes:
        """Generate and speed-adjust PCM for a single text chunk."""
        max_tokens = min(max(1200, len(chunk) * 22), 8000)
        audio = generate_speech_from_api(
            prompt=chunk,
            voice=voice,
            temperature=temp,
            top_p=top_p,
            repetition_penalty=rep_pen,
            max_tokens=max_tokens,
        )
        pcm = audio_to_pcm(audio)
        if not pcm:
            return b''
        return apply_speed(pcm, speed)

    # Sequential generation — LM Studio handles one request at a time, so parallel
    # submission doesn't reduce latency and risks request interference.
    for chunk in chunks:
        pcm = _generate_chunk(chunk)
        if pcm:
            yield pcm


# ---------------- API ---------------- #

@app.post("/v1/tts")
def tts(req: TTSRequest):

    if not req.text.strip():
        raise HTTPException(400, "Empty text")

    if req.voice not in AVAILABLE_VOICES:
        raise HTTPException(400, "Invalid voice")

    # Sanitize: strip any tag that isn't in the Orpheus vocab BEFORE anything else.
    # Unknown tags (e.g. <giggle>, <whisper>) cause the model to produce a gasp-like
    # noise or silence. We remove them silently here so the rest of the text still
    # generates correctly.
    clean_text = sanitize_emotion_tags(req.text)

    if not clean_text.strip():
        raise HTTPException(400, "Text is empty after removing invalid emotion tags")

    tone = TONE_PRESETS.get(req.tone, {})

    temperature = req.temperature or tone.get("temperature", DEFAULT_TEMPERATURE)
    top_p       = req.top_p        or tone.get("top_p",        DEFAULT_TOP_P)
    rep_pen     = req.repetition_penalty or tone.get("repetition_penalty", DEFAULT_REP_PENALTY)
    speed       = req.speed        or tone.get("speed",        1.0)

    # ---------------- EMOTION TAGS ---------------- #
    # Count only VALID emotion tags in the sanitized text.
    # Using _EMOTION_TAG_RE + VALID_ORPHEUS_EMOTIONS to be consistent.
    valid_emotion_matches = [
        m for m in _EMOTION_TAG_RE.finditer(clean_text)
        if m.group(1).lower() in VALID_ORPHEUS_EMOTIONS
    ]
    emotion_tag_count = len(valid_emotion_matches)

    if emotion_tag_count > 0 and req.temperature is None:
        # +0.05 boost — gives the model more expressive freedom for emotions
        # without causing instability (was 0.08, lowered for consistency)
        temperature = min(temperature + 0.05, 0.92)

    # ---------------- BILLING CALCULATION ---------------- #
    char_count = len(req.text)   # bill on original text length (user typed it)
    # Credit formula: 1 credit per character + 5 credits per valid emotion tag
    credits_deducted = char_count + (emotion_tag_count * 5)

    return StreamingResponse(
        generate_tts_stream(
            text=clean_text,    # ← sanitized text goes to model
            voice=req.voice,
            temp=temperature,
            top_p=top_p,
            rep_pen=rep_pen,
            speed=speed
        ),
        media_type="audio/wav",
        headers={
            "Content-Disposition": f"attachment; filename=voice_{datetime.utcnow().timestamp()}.wav",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
            # Billing headers — read by Express proxy to deduct user credits
            "x-credits-deducted": str(credits_deducted),
            "x-char-count": str(char_count),
            "x-emotion-tag-count": str(emotion_tag_count),
            "x-tone": req.tone or "",
        }
    )

@app.post("/v1/stt")
async def stt(file: UploadFile = File(...)):
    if whisper_model is None:
        raise HTTPException(500, "STT model not loaded")

    if not file:
        raise HTTPException(400, "No file uploaded")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        segments, info = whisper_model.transcribe(tmp_path, beam_size=5)
        text = " ".join([segment.text for segment in segments])
        return {"text": text.strip(), "duration": info.duration}
    finally:
        os.unlink(tmp_path)