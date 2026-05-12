from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
import io
import re
import numpy as np
from datetime import datetime, timezone

import os
import gguf_orpheus as _gguf_orpheus_module
from gguf_orpheus import generate_speech_from_api, AVAILABLE_VOICES, SAMPLE_RATE
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


def _patched_format_prompt(prompt, voice=_gguf_orpheus_module.DEFAULT_VOICE):
    """Corrected Orpheus prompt format with the full audio-start primer.

    The upstream isaiahbjork/orpheus-tts-local format wraps the input as
    "<|audio|>{voice}: {text}<|eot_id|>", which omits THREE tokens that
    canopyai's reference engine_class.py appends after <|eot_id|>:

        128260 = <custom_token_4>
        128261 = <custom_token_5>
        128257 = <custom_token_1>

    These three tokens are the audio-generation primer — they tell the
    model "now emit audio tokens, not text." Without them, the model has
    to "decide" how to begin generation, which manifests as:
      • garbage / hallucinated syllables before the first real word
      • unstable first-word pronunciation (esp. on unfamiliar tokens)
      • occasional emotion-tag misfires (no priming = no stable state)
    Adding them brings the gguf-via-LM-Studio path in line with canopyai's
    own reference implementation.
    """
    if voice not in _gguf_orpheus_module.AVAILABLE_VOICES:
        voice = _gguf_orpheus_module.DEFAULT_VOICE
    return (
        f"<|audio|>{voice}: {prompt}<|eot_id|>"
        f"<custom_token_4><custom_token_5><custom_token_1>"
    )


_gguf_orpheus_module.format_prompt = _patched_format_prompt
print("[prompt] Patched gguf_orpheus.format_prompt with canopy audio-primer tokens")


app = FastAPI()

# ---------------- AUTH ---------------- #
# Internal shared-secret auth so this service can't be hit directly. The
# Express proxy sends `Authorization: Bearer <FASTAPI_INTERNAL_KEY>` on every
# upstream call. Without this, anyone who can reach the FastAPI URL (ngrok,
# RunPod public endpoint, etc.) could bypass credit deduction entirely.
# Falls back to the older VOICEFORGE_API_KEY name so existing .env files keep
# working without edits.
FASTAPI_INTERNAL_KEY = (
    os.getenv("FASTAPI_INTERNAL_KEY")
    or os.getenv("VOICEFORGE_API_KEY")
    or "default_dev_key"
)


def require_internal_key(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    provided = authorization.split(None, 1)[1].strip()
    # Constant-time comparison to avoid timing side channels.
    import hmac
    if not hmac.compare_digest(provided, FASTAPI_INTERNAL_KEY):
        raise HTTPException(401, "Invalid internal key")
    return True


# ---------------- CONFIG ---------------- #

# Production defaults — Lex-au/Orpheus-FastAPI validated values, slightly
# tuned down on temperature for steadier prosody (Canopy's "stable" range
# is 0.3-0.6; we sit at 0.55 to suppress mid-sentence word-merging where
# the model occasionally rushes adjacent words like "believe communication").
#
# Why these specific numbers:
#   temperature 0.55 — inside Canopy's stable band, just below Lex-au's 0.60.
#     Trade-off: marginally less prosodic variation in exchange for fewer
#     run-together word pairs and more consistent emotion rendering.
#   top_p 0.90 — Lex-au default. Above 0.95 the model produces stutters and
#     skipped phonemes on long sentences.
#   repetition_penalty 1.10 — Canopy's documented MINIMUM for stable
#     generation. Anything higher makes the model speak faster, which is the
#     dominant cause of word-skipping in long chunks.
DEFAULT_TEMPERATURE = 0.55
# top_p 0.85 (was 0.90) — Canopy's stable band is 0.6-0.9. At 0.90 the model
# occasionally drops words mid-list ("built for creators" → "built profess…")
# and lets emotion-token sampling drift (laugh → yawn). 0.85 keeps prosodic
# variation while pulling the nucleus tighter.
DEFAULT_TOP_P = 0.85
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
    "calm": {"temperature": 0.42, "top_p": 0.82, "repetition_penalty": 1.10, "speed": 0.93},
    # Intimate, breathy, unhurried — close-mic, almost whispery
    "romantic": {"temperature": 0.38, "top_p": 0.78, "repetition_penalty": 1.10, "speed": 0.91},
    # Wide dynamic range — the voice rises and falls like a seasoned narrator
    "storytelling": {"temperature": 0.68, "top_p": 0.90, "repetition_penalty": 1.10, "speed": 0.97},
    # Slow, deliberate, calculated — creeping dread, barely above a whisper
    "horror": {"temperature": 0.35, "top_p": 0.72, "repetition_penalty": 1.10, "speed": 0.86},
    # Loud, sharp, intense — clipped words, punchy delivery
    "angry": {"temperature": 0.85, "top_p": 0.95, "repetition_penalty": 1.10, "speed": 1.08},
    # Confident, upbeat, driving — like a movie trailer narrator
    "adventurous": {"temperature": 0.72, "top_p": 0.90, "repetition_penalty": 1.10, "speed": 1.07},
    # Energetic, rapid, almost breathless — maximum enthusiasm
    "excited": {"temperature": 0.90, "top_p": 0.97, "repetition_penalty": 1.10, "speed": 1.14},
    # Heavy, slow, flat — grief-weighted delivery
    "sad": {"temperature": 0.40, "top_p": 0.80, "repetition_penalty": 1.10, "speed": 0.90},
    # Playful, quick, variable — comedic timing with bouncy rhythm
    "funny": {"temperature": 0.80, "top_p": 0.93, "repetition_penalty": 1.10, "speed": 1.05},
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


# Detect a lowercase→uppercase boundary inside a word (LinguaMic, VoiceForge)
# OR an uppercase→uppercase-then-lowercase boundary (AIPowered, XMLParser).
# Combined they cover all canonical CamelCase / PascalCase forms.
_CAMEL_ACRONYM_RE = re.compile(r'([A-Z])([A-Z][a-z])')
_CAMEL_LOWER_UPPER_RE = re.compile(r'([a-z])([A-Z])')


def split_camelcase_words(text: str) -> str:
    """Insert a space between CamelCase word parts so the TTS pronounces
    brand-style names correctly. Examples:

        LinguaMic       -> Lingua Mic
        ParaDox         -> Para Dox
        SinChan         -> Sin Chan
        VoiceForge      -> Voice Forge
        AIPowered       -> AI Powered    (acronym + word)
        XMLParser       -> XML Parser

    Emotion tags (<laugh>, <cough>, …) are passed through untouched —
    splitting them would break the special-token vocab. Billing in the
    /v1/tts handler stays on the ORIGINAL request text so users aren't
    charged for the auto-inserted spaces.
    """
    parts = re.split(r'(<\w+>)', text)
    for i, part in enumerate(parts):
        if part.startswith('<') and part.endswith('>'):
            continue  # leave emotion tags as-is
        # First the acronym→word boundary (so AIPowered -> AI Powered before
        # the lowercase rule pulls a single letter off the front).
        part = _CAMEL_ACRONYM_RE.sub(r'\1 \2', part)
        # Then the lowercase→uppercase boundary (LinguaMic -> Lingua Mic).
        part = _CAMEL_LOWER_UPPER_RE.sub(r'\1 \2', part)
        parts[i] = part
    return ''.join(parts)


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
    text: str = Field(..., min_length=1, max_length=50000)
    voice: Optional[str] = "tara"
    tone: Optional[str] = None
    # Pydantic enforces bounds; tampered/garbage values are rejected with 422.
    temperature: Optional[float] = Field(None, ge=0.0, le=1.5)
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0)
    repetition_penalty: Optional[float] = Field(None, ge=1.0, le=2.0)
    speed: Optional[float] = Field(None, ge=0.5, le=2.0)


def split_text(text, max_chars=300):
    """Split text into chunks at natural sentence boundaries.

    CRITICAL: emotion tags MUST stay inline with their surrounding sentence.
    Orpheus was trained with inline tags ("That was funny <laugh> truly"),
    so an isolated `<laugh>` chunk has no semantic context — the model's
    sampler ends up producing whichever non-verbal sound it lands on
    (gasp / cough / sigh) instead of a laugh. Keeping tags inline gives
    the model the surrounding words as cues so the right emotion renders.

    Strategy:
    1. Split at real sentence endings: . ? ! followed by whitespace.
    2. If a sentence is still very long (>max_chars), split at comma boundaries,
       and KEEP emotion tags attached to whichever clause they sit in.
    3. NEVER add artificial trailing punctuation — the model treats it as
       a pause cue.
    """
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    # Step 1: split at real sentence boundaries (. ? ! followed by space)
    raw_sentences = re.split(r'(?<=[.?!])\s+', text)

    chunks = []
    for sentence in raw_sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # ─── Sentence-leading emotion tag ────────────────────────────────────
        # Orpheus emotion tags render most fully when placed MID-SENTENCE with
        # words on both sides — that's the canonical training pattern
        # ("...that's interesting <laugh> I hadn't thought of that..."). When
        # a user writes "<laugh> Our mission..." we slide the tag forward to
        # the first natural break inside that sentence, so it ends up between
        # clauses rather than as vocal punctuation at a sentence boundary
        # (boundary tags render as a clipped gasp/cough-length sound).
        #
        # Strategy:
        #   1. If a comma exists within the first ~50 chars, slide the tag
        #      just before that comma — natural mid-clause position.
        #   2. Otherwise slide the tag past the first 2 words.
        #   3. If the sentence is too short to do either, keep the tag at
        #      the start and let _generate_chunk's emotion-aware sampling
        #      handle it.
        while True:
            m = re.match(r'^\s*(<\w+>)\s+(.+)$', sentence, re.DOTALL)
            if not m:
                break
            tag, body = m.group(1), m.group(2).strip()
            comma_pos = body.find(',')
            if 0 < comma_pos < 50:
                sentence = f"{body[:comma_pos]} {tag}{body[comma_pos:]}"
            else:
                parts = body.split(' ', 2)
                if len(parts) >= 3:
                    sentence = f"{parts[0]} {parts[1]} {tag} {parts[2]}"
                else:
                    # Too short to reposition — keep as-is, accept reduced
                    # emotion expression.
                    sentence = f"{tag} {body}"
                    break
            # One pass per leading tag; loop in case of stacked tags.

        # Handle the case where the entire input begins with a bare tag and
        # there's nothing after it.
        m_only = re.fullmatch(r'\s*(<\w+>)\s*', sentence)
        if m_only:
            chunks.append(m_only.group(1))
            continue

        if len(sentence) <= max_chars:
            chunks.append(sentence)
            continue

        # Step 2: long sentence — split at comma boundaries, keeping tags inline.
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

    return [c for c in chunks if c.strip()]



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
        """Generate and speed-adjust PCM for a single text chunk.

        Three regimes:
          • bare emotion tag (no surrounding text) — extremely rare, only when
            the user submits literally just '<laugh>'. Use low-randomness
            sampling so the tag renders as its canonical sound.
          • sentence containing an emotion tag — clamp temperature so the
            inline emotion stays consistent. The model already has semantic
            context from the surrounding words.
          • plain text — pass through whatever tone/user settings asked for.

        max_tokens scales generously with chunk length (chunk_len * 30 + 1500
        floor) so generation NEVER truncates mid-word — that's the main cause
        of perceived word-skipping at chunk tails.
        """
        chunk_stripped = chunk.strip()
        is_emotion_only = bool(re.fullmatch(r'<\w+>', chunk_stripped))
        has_emotion = bool(re.search(r'<\w+>', chunk_stripped))

        if is_emotion_only:
            # Bare tag — tightest sampling bounds so the tag renders as its
            # canonical sound (laugh = laugh, not gasp/yawn).
            eff_max_tokens = 400
            eff_temp = 0.40
            eff_top_p = 0.70
            eff_rep = 1.10
            eff_speed = 1.0
        elif has_emotion:
            # Inline emotion — pull BOTH temperature and top_p down hard.
            # Without this, the emotion-token slot samples freely and the
            # result drifts to whichever non-verbal sound the model lands on
            # (laugh → yawn is the common drift). 0.45/0.80 gives the inline
            # emotion enough variation to feel natural while keeping the
            # specific emotion type locked in.
            eff_max_tokens = min(max(1500, len(chunk) * 30), 8000)
            eff_temp = min(temp, 0.45)
            eff_top_p = min(top_p, 0.80)
            eff_rep = rep_pen
            eff_speed = speed
        else:
            # Plain text — generous token budget prevents truncation
            # (the primary cause of "skipped" or "merged" words at the tail
            # of long chunks). rep_pen stays at the user-supplied value, but
            # never goes below 1.10 (Orpheus stability floor).
            eff_max_tokens = min(max(1500, len(chunk) * 30), 8000)
            eff_temp = temp
            eff_top_p = top_p
            eff_rep = max(rep_pen, 1.10)
            eff_speed = speed

        audio = generate_speech_from_api(
            prompt=chunk,
            voice=voice,
            temperature=eff_temp,
            top_p=eff_top_p,
            repetition_penalty=eff_rep,
            max_tokens=eff_max_tokens,
        )
        pcm = audio_to_pcm(audio)
        if not pcm:
            return b''
        return apply_speed(pcm, eff_speed)

    # Sequential generation — LM Studio handles one request at a time, so parallel
    # submission doesn't reduce latency and risks request interference.
    for chunk in chunks:
        pcm = _generate_chunk(chunk)
        if pcm:
            yield pcm


# ---------------- API ---------------- #

# Per-voice expressiveness profile. "expressive=True" means the voice was
# trained with enough emotional variety that emotion tags render reliably;
# False voices may underplay or mis-render some tags (e.g. <gasp> on Zac
# can come out as a quiet exhale). Surface this in /v1/voices so the
# frontend / API consumers can pick a suitable voice for emotional content.
VOICE_PROFILES = {
    "tara":  {"expressive": True,  "note": "Most expressive — best for emotional content"},
    "jess":  {"expressive": True,  "note": "Warm, expressive — great for storytelling"},
    "leah":  {"expressive": True,  "note": "Gentle, expressive — natural emotion rendering"},
    "leo":   {"expressive": True,  "note": "Confident, moderately expressive"},
    "mia":   {"expressive": True,  "note": "Bright, expressive — good for upbeat content"},
    "zoe":   {"expressive": False, "note": "Cool, less emotive — emotions may render subtly"},
    "dan":   {"expressive": False, "note": "Steady — best for narration; emotions render weakly"},
    "zac":   {"expressive": False, "note": "Deep, stoic — emotions may render weakly"},
}


@app.get("/v1/voices")
def list_voices(_auth: bool = Depends(require_internal_key)):
    voices_with_meta = [
        {"id": v, **VOICE_PROFILES.get(v, {"expressive": True, "note": ""})}
        for v in AVAILABLE_VOICES
    ]
    return {
        "voices": voices_with_meta,
        "tones": list(TONE_PRESETS.keys()),
        "emotions": list(VALID_ORPHEUS_EMOTIONS),
    }


@app.post("/v1/tts")
def tts(req: TTSRequest, _auth: bool = Depends(require_internal_key)):

    if not req.text.strip():
        raise HTTPException(400, "Empty text")

    if req.voice not in AVAILABLE_VOICES:
        raise HTTPException(400, "Invalid voice")

    # Sanitize: strip any tag that isn't in the Orpheus vocab BEFORE anything else.
    # Unknown tags (e.g. <giggle>, <whisper>) cause the model to produce a gasp-like
    # noise or silence. We remove them silently here so the rest of the text still
    # generates correctly.
    clean_text = sanitize_emotion_tags(req.text)

    # Auto-split CamelCase brand names so the TTS pronounces them correctly:
    # "LinguaMic" → "Lingua Mic", "VoiceForge" → "Voice Forge". Billing below
    # uses the ORIGINAL req.text length so users aren't charged for the
    # auto-inserted spaces.
    clean_text = split_camelcase_words(clean_text)

    if not clean_text.strip():
        raise HTTPException(400, "Text is empty after removing invalid emotion tags")

    tone = TONE_PRESETS.get(req.tone, {})

    # Explicit None checks — `or` would treat a legitimate 0.0 as falsy and
    # silently swap in the default. That matters for temperature in particular.
    temperature = req.temperature if req.temperature is not None else tone.get("temperature", DEFAULT_TEMPERATURE)
    top_p       = req.top_p        if req.top_p        is not None else tone.get("top_p",        DEFAULT_TOP_P)
    rep_pen     = req.repetition_penalty if req.repetition_penalty is not None else tone.get("repetition_penalty", DEFAULT_REP_PENALTY)
    speed       = req.speed        if req.speed        is not None else tone.get("speed",        1.0)

    # ---------------- EMOTION TAGS ---------------- #
    # Count only VALID emotion tags in the sanitized text.
    valid_emotion_matches = [
        m for m in _EMOTION_TAG_RE.finditer(clean_text)
        if m.group(1).lower() in VALID_ORPHEUS_EMOTIONS
    ]
    emotion_tag_count = len(valid_emotion_matches)

    # Note: we deliberately DO NOT boost temperature when emotions are present.
    # Higher temperature with emotion tags causes the model to sample drift
    # across non-verbal tokens (laugh -> gasp/cough). _generate_chunk further
    # caps the temperature for emotion-bearing chunks to keep them consistent.

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
            "Content-Disposition": f"attachment; filename=voice_{datetime.now(timezone.utc).timestamp()}.wav",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
            # Billing headers — read by Express proxy to deduct user credits
            "x-credits-deducted": str(credits_deducted),
            "x-char-count": str(char_count),
            "x-emotion-tag-count": str(emotion_tag_count),
            "x-tone": req.tone or "",
        }
    )

# 25 MiB matches the Express multer cap; anything bigger would have been
# rejected upstream. Belt-and-braces in case this is hit directly.
_MAX_STT_BYTES = 25 * 1024 * 1024


@app.post("/v1/stt")
async def stt(file: UploadFile = File(...), _auth: bool = Depends(require_internal_key)):
    if whisper_model is None:
        raise HTTPException(500, "STT model not loaded")

    if not file:
        raise HTTPException(400, "No file uploaded")

    contents = await file.read()
    if not contents:
        raise HTTPException(400, "Empty audio file")
    if len(contents) > _MAX_STT_BYTES:
        raise HTTPException(413, f"Audio file too large. Max {_MAX_STT_BYTES // (1024 * 1024)}MB.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        segments, info = whisper_model.transcribe(tmp_path, beam_size=5)
        text = " ".join([segment.text for segment in segments])
        return {"text": text.strip(), "duration": info.duration}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass