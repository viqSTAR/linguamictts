from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
import sys
import io
import wave
import re
import numpy as np
import tempfile
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Add orpheus-tts-local to path (supports env override + common local paths)
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_ORPHEUS_PATH_CANDIDATES = [
    os.getenv("ORPHEUS_TTS_LOCAL_PATH", ""),
    os.path.join(os.path.dirname(_BASE_DIR), "orpheus-tts-local"),
    r"C:\Users\Vikashdeep Prasad\Documents\The Billion Dollar\orpheus-tts-local",
    r"C:\Users\Vikashdeep Prasad\orpheus-tts-local",
]

for _candidate in _ORPHEUS_PATH_CANDIDATES:
    if _candidate and os.path.isdir(_candidate):
        if _candidate not in sys.path:
            sys.path.insert(0, _candidate)
        break

import gguf_orpheus as _gguf_orpheus_module
from gguf_orpheus import generate_speech_from_api, AVAILABLE_VOICES, SAMPLE_RATE

# gguf_orpheus.py hardcodes 127.0.0.1:1234 — override it so Docker containers
# correctly reach LM Studio on the host machine via host.docker.internal
_lm_host = os.getenv("LM_STUDIO_HOST", "127.0.0.1")
_lm_port = os.getenv("LM_STUDIO_PORT", "1234")
_gguf_orpheus_module.API_URL = f"http://{_lm_host}:{_lm_port}/v1/completions"
print(f"[LM Studio] API_URL set to: {_gguf_orpheus_module.API_URL}")
from faster_whisper import WhisperModel

app = FastAPI(
    title="VoiceForge API",
    version="1.0.0",
    description=(
        "## VoiceForge — Orpheus TTS & STT API\n\n"
        "High-quality, emotion-aware Text-to-Speech and Speech-to-Text powered by "
        "Orpheus-3B (GGUF) running on a local GPU via LM Studio, and faster-whisper for transcription.\n\n"
        "### Authentication\n"
        "All `/v1/*` routes require a Bearer token in the `Authorization` header:\n"
        "```\nAuthorization: Bearer <your-api-key>\n```\n\n"
        "### Emotion Tags\n"
        "Embed emotion tags directly in your text to make the voice more expressive:\n"
        "`<laugh>`, `<sigh>`, `<giggle>`, `<gasp>`, `<chuckle>`, `<cough>`, `<groan>`, `<yawn>`, `<sniffle>`\n\n"
        "### Tone Presets\n"
        "Use `tone` to apply a pre-tuned voice style: `calm`, `romantic`, `adventurous`, `storytelling`, `horror`, `angry`"
    ),
    contact={"name": "VoiceForge Support", "email": "support@voiceforge.ai"},
    license_info={"name": "Proprietary"},
    openapi_tags=[
        {"name": "TTS", "description": "Text-to-Speech generation endpoints"},
        {"name": "STT", "description": "Speech-to-Text transcription endpoints"},
        {"name": "System", "description": "Health check and server info"},
    ],
)

# ── Auth ────────────────────────────────────────────────────────────────────
_bearer_scheme = HTTPBearer(auto_error=False)

def verify_api_key(
    credentials: HTTPAuthorizationCredentials = Security(_bearer_scheme),
) -> str:
    """Validate Bearer token against VOICEFORGE_API_KEY in .env.
    Later: swap body to call Express /internal/validate-key instead.
    """
    expected = os.getenv("VOICEFORGE_API_KEY", "")
    if not expected:
        raise HTTPException(
            status_code=500,
            detail="Server misconfiguration: API key not set.",
        )
    if credentials is None or credentials.credentials != expected:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: missing or invalid API key. Pass it as: Authorization: Bearer <key>",
        )
    return credentials.credentials
# ─────────────────────────────────────────────────────────────────────────────

# Load whisper once at startup — auto-detect GPU vs CPU
import torch as _torch
_whisper_device   = "cuda"  if _torch.cuda.is_available() else "cpu"
_whisper_compute  = "float16" if _whisper_device == "cuda" else "int8"
print(f"Loading Whisper STT model... (device={_whisper_device}, compute={_whisper_compute})")
whisper_model = WhisperModel("base", device=_whisper_device, compute_type=_whisper_compute)
print("Whisper loaded!")

# Valid emotion tags (aligned with orpheus-tts-local)
VALID_TAGS = {"giggle", "laugh", "chuckle", "sigh", "cough", "sniffle", "groan", "yawn", "gasp"}
EMOTION_TAG_RE = re.compile(r'<(\w+)>')
WORD_RE = re.compile(r"\b[\w']+\b")

# Conservative defaults reduce fast/fuzzy pronunciation artifacts.
DEFAULT_TEMPERATURE = 0.35
DEFAULT_TOP_P = 0.72
DEFAULT_REPETITION_PENALTY = 1.24

TONE_PRESETS = {
    # ── calm ──────────────────────────────────────────────────────────────────
    # Light, airy, gentle — meditation app style, not slow/heavy
    "calm": {
        "temperature": 0.28,          # airy and natural, not robotic-flat
        "top_p": 0.68,
        "repetition_penalty": 1.28,
        "speed": 0.94,                # slightly slow = unhurried, not heavy
        "lead_tag": None,             # no emotion tag — calm = clear neutral
        "pause_seconds": 0.22,        # gentle breathing room between sentences
    },
    # ── romantic ──────────────────────────────────────────────────────────────
    # Soft, intimate, warm — love stories, heartfelt messages
    "romantic": {
        "temperature": 0.26,
        "top_p": 0.65,
        "repetition_penalty": 1.31,
        "speed": 0.92,
        "lead_tag": "sigh",           # breathy sigh = intimate feel
        "pause_seconds": 0.20,
    },
    # ── storytelling ──────────────────────────────────────────────────────────
    # Expressive, dramatic, engaging — audiobook narrator style
    "storytelling": {
        "temperature": 0.37,          # more expressive than calm
        "top_p": 0.75,
        "repetition_penalty": 1.21,
        "speed": 0.95,
        "lead_tag": None,             # content drives the tone, no forced tag
        "pause_seconds": 0.26,        # dramatic pauses between sentences
    },
    # ── horror ────────────────────────────────────────────────────────────────
    # Tense, eerie, unsettling — creepypasta, horror narration style
    "horror": {
        "temperature": 0.25,          # deliberate and controlled delivery
        "top_p": 0.64,
        "repetition_penalty": 1.32,
        "speed": 0.93,                # slightly slow but natural pitch — eerie not heavy
        "lead_tag": "sniffle",        # subtle unsettling cue, not a heavy groan
        "pause_seconds": 0.32,        # long dramatic pauses = tension and dread
    },
    # ── angry ─────────────────────────────────────────────────────────────────
    # Intense, volatile, confrontational — maximum aggression
    "angry": {
        "temperature": 0.55,          # maximum chaos/expressiveness
        "top_p": 0.90,
        "repetition_penalty": 1.10,   # very low = emphatic/repetitive bursts allowed
        "speed": 1.12,                # fastest possible — clipped and relentless
        "lead_tag": "groan",          # frustrated grunt at the start
        "pause_seconds": 0.03,        # almost no breathing room = pure intensity
    },
    # ── adventurous ───────────────────────────────────────────────────────────
    # Energetic, bold, punchy — action, travel, excitement
    "adventurous": {
        "temperature": 0.42,
        "top_p": 0.78,
        "repetition_penalty": 1.18,
        "speed": 1.05,
        "lead_tag": "gasp",           # starts with excitement
        "pause_seconds": 0.08,
    },
    # ── excited ───────────────────────────────────────────────────────────────
    # Bubbly, high-energy, enthusiastic — announcements, celebrations
    "excited": {
        "temperature": 0.46,
        "top_p": 0.82,
        "repetition_penalty": 1.15,
        "speed": 1.09,                # fastest tone
        "lead_tag": "giggle",
        "pause_seconds": 0.05,
    },
    # ── sad ───────────────────────────────────────────────────────────────────
    # Soft, emotional, heartbroken — grief, loss, melancholy
    "sad": {
        "temperature": 0.26,          # restrained but natural, not robotic
        "top_p": 0.64,
        "repetition_penalty": 1.30,
        "speed": 0.93,                # slightly slow = heavy heart, not heavy voice
        "lead_tag": "sniffle",        # emotional cue at start
        "pause_seconds": 0.26,        # quiet pauses = grief and reflection
    },
}

class TTSRequest(BaseModel):
    text: str = Field(
        ...,
        description="Text to synthesise. Max 5000 chars. Supports emotion tags like `<laugh>`, `<sigh>`, etc.",
        examples=["<sigh> Hello there, welcome to VoiceForge!"],
    )
    voice: Optional[str] = Field(
        default="tara",
        description="Voice ID. Use GET /v1/voices to see all available voices.",
        examples=["tara"],
    )
    temperature: Optional[float] = Field(
        default=None,
        description="Sampling temperature (0.1–1.0). Lower = more consistent, higher = more expressive. Defaults to 0.35.",
        examples=[0.35],
    )
    top_p: Optional[float] = Field(
        default=None,
        description="Top-p nucleus sampling (0.1–1.0). Defaults to 0.72.",
        examples=[0.72],
    )
    repetition_penalty: Optional[float] = Field(
        default=None,
        description="Penalise repeated tokens to prevent looping artefacts. Defaults to 1.24.",
        examples=[1.24],
    )
    speed: Optional[float] = Field(
        default=None,
        ge=0.90,
        le=1.10,
        description="Playback speed multiplier. Range: 0.90 (slower) – 1.10 (faster). Defaults to 1.0.",
        examples=[1.0],
    )
    tone: Optional[str] = Field(
        default=None,
        description="Tone preset. One of: calm, romantic, adventurous, storytelling, horror, angry. Overrides temperature/top_p/speed with tuned values.",
        examples=["calm"],
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "text": "<sigh> Welcome to VoiceForge. Your voice, your story.",
                    "voice": "tara",
                    "tone": "calm",
                },
                {
                    "text": "<laugh> This is amazing! I can't believe how good this sounds.",
                    "voice": "leo",
                    "temperature": 0.4,
                    "speed": 1.02,
                },
            ]
        }
    }

def validate_emotion_tags(text: str) -> str:
    tags = re.findall(r'<(\w+)>', text)
    for tag in tags:
        if tag not in VALID_TAGS:
            raise HTTPException(status_code=400, detail=f"Invalid emotion tag: <{tag}>. Allowed: {VALID_TAGS}")
    return text


def split_text_for_tts(text: str, max_chars: int = 200) -> list[str]:
    text = text.strip()
    if not text:
        return []

    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        # Hard split very long single sentence.
        if len(sentence) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            parts = re.split(r'(?<=[,;:])\s+', sentence)
            temp = ""
            for part in parts:
                part = part.strip()
                if not part:
                    continue
                candidate = f"{temp} {part}".strip() if temp else part
                if len(candidate) <= max_chars:
                    temp = candidate
                else:
                    if temp:
                        chunks.append(temp)
                    temp = part
            if temp:
                chunks.append(temp)
            continue

        candidate = f"{current} {sentence}".strip() if current else sentence
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = sentence

    if current:
        chunks.append(current)

    return chunks


def apply_emotion_context(chunks: list[str]) -> list[str]:
    """Carry the latest emotion tag forward when a chunk has no explicit tag."""
    if not chunks:
        return []

    contextualized = []
    active_tag = None

    for chunk in chunks:
        tags = [tag for tag in EMOTION_TAG_RE.findall(chunk) if tag in VALID_TAGS]
        if tags:
            active_tag = tags[-1]
            contextualized.append(chunk)
            continue

        if active_tag:
            contextualized.append(f"<{active_tag}> {chunk}")
        else:
            contextualized.append(chunk)

    return contextualized


def normalize_tone(tone: Optional[str]) -> Optional[str]:
    if tone is None:
        return None
    clean = tone.strip().lower()
    if not clean:
        return None
    if clean not in TONE_PRESETS:
        allowed = ", ".join(sorted(TONE_PRESETS.keys()))
        raise HTTPException(status_code=400, detail=f"Invalid tone: {clean}. Allowed: {allowed}")
    return clean


def apply_lead_tone_tag(chunks: list[str], lead_tag: Optional[str]) -> list[str]:
    """Prepend the tone preset's lead emotion tag to the first chunk.

    Skipped when the first chunk already contains ANY emotion tag anywhere
    (not just at the start) — avoids double/conflicting signals that cause
    the model to produce only sound effects and skip the actual words.

    Example bug this fixes:
        text="hi <gasp>", tone=calm (lead_tag=sigh)
        Before fix → model got "<sigh> hi <gasp>" → just gasped, skipped "hi"
        After fix  → model gets "hi <gasp>"        → says "hi" then gasps ✓
    """
    if not chunks or not lead_tag:
        return chunks
    # Skip if the first chunk already has ANY emotion tag inside it
    if EMOTION_TAG_RE.search(chunks[0]):
        return chunks
    copy_chunks = chunks[:]
    copy_chunks[0] = f"<{lead_tag}> {copy_chunks[0]}"
    return copy_chunks


def pcm_duration_seconds(pcm_bytes: bytes) -> float:
    return len(pcm_bytes) / (2.0 * SAMPLE_RATE)


def is_chunk_too_fast(chunk_text: str, pcm_bytes: bytes) -> bool:
    words = max(1, len(WORD_RE.findall(chunk_text)))
    duration = pcm_duration_seconds(pcm_bytes)
    # If generated duration is much shorter than natural speech, quality is usually fuzzy.
    min_expected = max(0.40, words * 0.16)
    return duration < min_expected


def slow_down_pcm_bytes(pcm_bytes: bytes, slowdown: float = 0.92) -> bytes:
    """Slightly stretch time for very fast chunks without changing sample rate."""
    if not pcm_bytes or len(pcm_bytes) < 4:
        return pcm_bytes

    if len(pcm_bytes) % 2 == 1:
        pcm_bytes = pcm_bytes[:-1]

    samples = np.frombuffer(pcm_bytes, dtype=np.int16)
    if len(samples) < 16:
        return pcm_bytes

    # slowdown < 1.0 means longer duration.
    new_len = int(len(samples) / max(0.5, slowdown))
    if new_len <= len(samples):
        return pcm_bytes

    x_old = np.arange(len(samples), dtype=np.float32)
    x_new = np.linspace(0, len(samples) - 1, new_len, dtype=np.float32)
    stretched = np.interp(x_new, x_old, samples.astype(np.float32))
    stretched = np.clip(stretched, -32768, 32767).astype(np.int16)
    return stretched.tobytes()


def apply_speed_to_pcm_bytes(pcm_bytes: bytes, speed: float) -> bytes:
    """Apply user speed control with minimal voice-character change.

    speed > 1.0 => faster (shorter)
    speed < 1.0 => slower (longer)
    """
    if not pcm_bytes or speed is None or abs(speed - 1.0) < 1e-3:
        return pcm_bytes

    if len(pcm_bytes) % 2 == 1:
        pcm_bytes = pcm_bytes[:-1]

    samples = np.frombuffer(pcm_bytes, dtype=np.int16)
    if len(samples) < 16:
        return pcm_bytes

    new_len = int(len(samples) / speed)
    if new_len < 16:
        return pcm_bytes

    x_old = np.arange(len(samples), dtype=np.float32)
    x_new = np.linspace(0, len(samples) - 1, new_len, dtype=np.float32)
    resampled = np.interp(x_new, x_old, samples.astype(np.float32))
    resampled = np.clip(resampled, -32768, 32767).astype(np.int16)
    return resampled.tobytes()


def audio_to_pcm_bytes(audio_data) -> bytes:
    if audio_data is None:
        return b""

    if isinstance(audio_data, (bytes, bytearray)):
        return bytes(audio_data)

    if isinstance(audio_data, list):
        if len(audio_data) > 0 and isinstance(audio_data[0], (bytes, bytearray)):
            return b"".join(bytes(chunk) for chunk in audio_data if chunk)
        return np.asarray(audio_data, dtype=np.int16).tobytes()

    return np.asarray(audio_data, dtype=np.int16).tobytes()

def audio_to_wav_bytes(audio_data) -> bytes:
    pcm_bytes = audio_to_pcm_bytes(audio_data)

    if not pcm_bytes:
        raise HTTPException(status_code=500, detail="Audio generation returned empty output")

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm_bytes)
    buf.seek(0)
    return buf.read()

# ── Credit / Usage Helpers ──────────────────────────────────────────────────

# Pricing config — change these values to adjust billing rates
CREDIT_PER_CHAR    = 1    # 1 credit per character
CREDIT_PER_EMOTION = 2    # 2 credits per emotion tag e.g. <laugh>, <gasp>
CREDIT_PER_TONE    = 10   # 10 extra credits when a tone preset is used


def compute_billing(text: str, tone: Optional[str] = None) -> dict:
    """Compute full billing breakdown for a TTS request.

    Pricing:
        - 1 credit  per character (emotion tags stripped first)
        - 6 credits per emotion tag (<laugh>, <gasp>, <sigh>, etc.)
        - 10 credits flat fee when a tone preset is used (calm, angry, etc.)

    Returns dict with full breakdown so every value can be sent in response headers.
    """
    # Count valid emotion tags only (invalid tags already blocked by validator)
    found_tags = [t for t in EMOTION_TAG_RE.findall(text) if t in VALID_TAGS]
    emotion_tag_count = len(found_tags)

    # Strip ALL <tag> tokens then count remaining chars
    clean = re.sub(r'<\w+>', '', text).strip()
    billable_chars = len(clean)

    char_credits = billable_chars * CREDIT_PER_CHAR
    tag_credits  = emotion_tag_count * CREDIT_PER_EMOTION
    tone_credits = CREDIT_PER_TONE if tone else 0
    total_credits = char_credits + tag_credits + tone_credits

    return {
        "raw_chars":      len(text),
        "billable_chars": billable_chars,
        "emotion_tags":   emotion_tag_count,
        "tag_credits":    tag_credits,
        "char_credits":   char_credits,
        "tone_credits":   tone_credits,
        "total_credits":  total_credits,
    }


def deduct_credits(api_key: str, total_credits: int) -> dict:
    """Stub: deduct credits for a TTS request.

    Currently returns a mock response so the pipeline works end-to-end.
    When Phase 3 (Express backend) is ready, replace the body with:

        resp = httpx.post(
            f"{EXPRESS_URL}/internal/deduct",
            json={"api_key": api_key, "credits": total_credits},
            timeout=5,
        )
        resp.raise_for_status()
        return resp.json()   # {"credits_deducted": N, "credits_remaining": M}
    """
    print(f"[credits-stub] api_key={api_key[:12]}... total_credits={total_credits}")
    return {"credits_deducted": total_credits, "credits_remaining": -1}

# ─────────────────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    tags=["System"],
    summary="Health check",
    response_description="Server status and available voices",
)
def health():
    """Returns server status and the list of available Orpheus voices.
    This endpoint is **public** — no API key required.
    Use it to verify the server is running before making TTS/STT calls.
    """
    return {"status": "ok", "voices": AVAILABLE_VOICES}

@app.get(
    "/v1/voices",
    tags=["TTS"],
    summary="List available voices",
    response_description="Array of voice IDs you can pass to /v1/tts",
)
def get_voices(api_key: str = Depends(verify_api_key)):
    """Returns all Orpheus voice IDs available for TTS generation.

    Pass any of these as the `voice` field in your `/v1/tts` request.
    """
    return {"voices": AVAILABLE_VOICES}

@app.post(
    "/v1/tts",
    tags=["TTS"],
    summary="Generate speech from text",
    response_description="WAV audio file (mono, 24kHz). Response headers contain usage metadata.",
    responses={
        200: {"description": "Audio generated successfully. Check response headers for X-Billable-Chars and X-Credits-Deducted."},
        400: {"description": "Bad request — empty text, text too long, invalid voice, or invalid emotion tag."},
        401: {"description": "Unauthorized — missing or invalid API key."},
        500: {"description": "Internal error — audio generation failed."},
    },
)
def text_to_speech(request: TTSRequest, api_key: str = Depends(verify_api_key)):
    """Convert text to speech using the Orpheus-3B TTS model.

    - Supports **emotion tags** in text: `<laugh>`, `<sigh>`, `<giggle>`, `<gasp>`, `<chuckle>`, `<cough>`, `<groan>`, `<yawn>`, `<sniffle>`
    - Supports **tone presets** via the `tone` field: `calm`, `romantic`, `adventurous`, `storytelling`, `horror`, `angry`
    - Long text is automatically split into chunks and stitched together
    - Returns a **.wav** file (mono, 24 kHz, 16-bit PCM)

    **Response Headers:**
    - `X-Char-Count` — raw character count of input
    - `X-Billable-Chars` — characters after stripping emotion tags (what you are charged)
    - `X-Credits-Deducted` — credits deducted this request
    - `X-Credits-Remaining` — remaining credit balance (-1 until Express backend connects)
    - `X-Chunk-Count` — number of TTS chunks processed
    - `X-Tone` — tone preset applied (or "none")
    - `X-Speed` — speed multiplier applied
    """
    if not request.text or len(request.text.strip()) == 0:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if len(request.text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long. Max 5000 chars")
    if request.voice not in AVAILABLE_VOICES:
        raise HTTPException(status_code=400, detail=f"Invalid voice. Choose from: {AVAILABLE_VOICES}")

    text = validate_emotion_tags(request.text)
    tone = normalize_tone(request.tone)
    tone_preset = TONE_PRESETS.get(tone, {}) if tone else {}

    temperature = request.temperature if request.temperature is not None else tone_preset.get("temperature", DEFAULT_TEMPERATURE)
    top_p = request.top_p if request.top_p is not None else tone_preset.get("top_p", DEFAULT_TOP_P)
    repetition_penalty = request.repetition_penalty if request.repetition_penalty is not None else tone_preset.get("repetition_penalty", DEFAULT_REPETITION_PENALTY)
    output_speed = request.speed if request.speed is not None else tone_preset.get("speed", 1.0)
    pause_seconds = tone_preset.get("pause_seconds", 0.12)

    try:
        chunks = split_text_for_tts(text)
        chunks = apply_lead_tone_tag(chunks, tone_preset.get("lead_tag"))
        chunks = apply_emotion_context(chunks)
        if not chunks:
            raise HTTPException(status_code=400, detail="Text cannot be empty")

        pcm_parts = []
        pause_bytes = np.zeros(int(SAMPLE_RATE * pause_seconds), dtype=np.int16).tobytes()
        for i, chunk in enumerate(chunks):
            chunk_pcm = b""
            chunk_ok = False
            for attempt in range(3):
                attempt_temp = max(0.18, temperature - (0.08 * attempt))
                attempt_top_p = max(0.60, top_p - (0.08 * attempt))
                attempt_rep = min(1.40, repetition_penalty + (0.07 * attempt))

                audio_data = generate_speech_from_api(
                    prompt=chunk,
                    voice=request.voice,
                    temperature=attempt_temp,
                    top_p=attempt_top_p,
                    repetition_penalty=attempt_rep,
                )
                chunk_pcm = audio_to_pcm_bytes(audio_data)

                if chunk_pcm and not is_chunk_too_fast(chunk, chunk_pcm):
                    chunk_ok = True
                    break

            if not chunk_pcm:
                raise HTTPException(status_code=500, detail=f"Audio generation failed for chunk {i + 1}/{len(chunks)}")

            if not chunk_ok and is_chunk_too_fast(chunk, chunk_pcm):
                chunk_pcm = slow_down_pcm_bytes(chunk_pcm, slowdown=0.92)

            pcm_parts.append(chunk_pcm)
            if i < len(chunks) - 1:
                pcm_parts.append(pause_bytes)

        if not pcm_parts:
            raise HTTPException(status_code=500, detail="No audio generated for provided text")

        final_pcm = b"".join(pcm_parts)
        final_pcm = apply_speed_to_pcm_bytes(final_pcm, output_speed)
        wav_bytes = audio_to_wav_bytes(final_pcm)
        generated_name = f"voiceforge_{datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')}.wav"

        # ── Credit deduction ────────────────────────────────────────────────
        billing       = compute_billing(text, tone)
        credit_result = deduct_credits(api_key, billing["total_credits"])
        # ────────────────────────────────────────────────────────────────────

        return StreamingResponse(
            io.BytesIO(wav_bytes),
            media_type="audio/wav",
            headers={
                "X-Char-Count":          str(billing["raw_chars"]),
                "X-Billable-Chars":      str(billing["billable_chars"]),
                "X-Emotion-Tag-Count":   str(billing["emotion_tags"]),
                "X-Tag-Credits":         str(billing["tag_credits"]),
                "X-Char-Credits":        str(billing["char_credits"]),
                "X-Tone-Credits":        str(billing["tone_credits"]),
                "X-Credits-Deducted":    str(credit_result["credits_deducted"]),
                "X-Credits-Remaining":   str(credit_result["credits_remaining"]),
                "X-Chunk-Count": str(len(chunks)),
                "X-Speed": str(output_speed),
                "X-Tone": str(tone if tone else "none"),
                "Content-Disposition": f"attachment; filename=\"{generated_name}\"",
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post(
    "/v1/stt",
    tags=["STT"],
    summary="Transcribe audio to text",
    response_description="JSON with transcript, detected language, and audio duration",
    responses={
        200: {"description": "Transcription successful."},
        400: {"description": "Unsupported file format. Accepted: .wav, .mp3, .m4a, .ogg"},
        401: {"description": "Unauthorized — missing or invalid API key."},
        500: {"description": "Transcription failed."},
    },
)
async def speech_to_text(file: UploadFile = File(..., description="Audio file to transcribe. Accepted formats: .wav, .mp3, .m4a, .ogg"), api_key: str = Depends(verify_api_key)):
    """Transcribe an audio file to text using faster-whisper (base model, GPU-accelerated).

    - Accepts **.wav**, **.mp3**, **.m4a**, **.ogg**
    - Returns the **transcript**, **detected language**, and **audio duration** in seconds
    - Powered by faster-whisper running on CUDA
    """
    if not file.filename.endswith(('.wav', '.mp3', '.m4a', '.ogg')):
        raise HTTPException(status_code=400, detail="Unsupported file format")

    try:
        contents = await file.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        segments, info = whisper_model.transcribe(tmp_path)
        transcript = " ".join([s.text for s in segments])
        os.unlink(tmp_path)

        return {
            "transcript": transcript.strip(),
            "language": info.language,
            "duration": info.duration
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))