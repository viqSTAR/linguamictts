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

DEFAULT_TEMPERATURE = 0.35
DEFAULT_TOP_P = 0.72
DEFAULT_REP_PENALTY = 1.2

TONE_PRESETS = {
    # Peaceful and measured, but not completely flat
    "calm": {"temperature": 0.32, "top_p": 0.70, "speed": 0.94},
    # Intimate and soft, slightly slower
    "romantic": {"temperature": 0.30, "top_p": 0.68, "speed": 0.92},
    # Dynamic and highly expressive narrator, moderate speed
    "storytelling": {"temperature": 0.42, "top_p": 0.78, "speed": 0.98},
    # Tense, calculated, and slow to build suspense
    "horror": {"temperature": 0.28, "top_p": 0.65, "speed": 0.90},
    # Sharp, intense, and emphatic (lowered speed to prevent pitch rise)
    "angry": {"temperature": 0.52, "top_p": 0.80, "speed": 1.05},
    # Bold, energetic, and punchy
    "adventurous": {"temperature": 0.45, "top_p": 0.80, "speed": 1.06},
    # Enthusiastic, bubbly, and fast
    "excited": {"temperature": 0.48, "top_p": 0.82, "speed": 1.10},
    # Somber, subdued, and moderately slow (preventing too much pitch drop)
    "sad": {"temperature": 0.32, "top_p": 0.68, "speed": 0.94},
    # Lighthearted, bubbly, and slightly fast
    "funny": {"temperature": 0.46, "top_p": 0.82, "speed": 1.05},
}

# ---------------- REQUEST ---------------- #

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "tara"
    tone: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    repetition_penalty: Optional[float] = None
    speed: Optional[float] = None


# ---------------- UTIL ---------------- #

def split_text(text, max_chars=100):
    import re
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    words = text.split(' ')
    
    chunks = []
    current_chunk = []
    current_len = 0
    
    for word in words:
        if not word:
            continue
            
        word_len = len(word) + 1 # +1 for space
        
        # If adding this word exceeds max_chars
        if current_len + word_len > max_chars and current_chunk:
            chunk_str = " ".join(current_chunk)
            # Force a trailing comma if no punctuation exists, to pad the audio 
            # and prevent the Orpheus decoder from chopping the last syllable
            if not re.search(r'[.?!,\n]$', chunk_str):
                chunk_str += ","
            chunks.append(chunk_str)
            
            current_chunk = [word]
            current_len = word_len
        else:
            current_chunk.append(word)
            current_len += word_len
            
            # Break early if we hit strong punctuation and chunk is reasonably sized
            if re.search(r'[.?!]$', word) and current_len > 40:
                chunk_str = " ".join(current_chunk)
                chunks.append(chunk_str)
                current_chunk = []
                current_len = 0
                
    if current_chunk:
        chunk_str = " ".join(current_chunk)
        if not re.search(r'[.?!,\n]$', chunk_str):
            chunk_str += "." 
        chunks.append(chunk_str)
        
    return chunks


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
    if not speed or speed == 1.0:
        return pcm_bytes

    samples = np.frombuffer(pcm_bytes, dtype=np.int16)
    new_len = int(len(samples) / speed)

    x_old = np.arange(len(samples))
    x_new = np.linspace(0, len(samples)-1, new_len)

    resampled = np.interp(x_new, x_old, samples).astype(np.int16)
    return resampled.tobytes()


# ---------------- CORE ---------------- #

def generate_tts_stream(text, voice, temp, top_p, rep_pen, speed):

    chunks = split_text(text)

    # Yield a dummy WAV header with unknown size (0xFFFFFFFF)
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

    for chunk in chunks:

        audio = generate_speech_from_api(
            prompt=chunk,
            voice=voice,
            temperature=temp,
            top_p=top_p,
            repetition_penalty=rep_pen,
        )

        pcm = audio_to_pcm(audio)

        if not pcm:
            continue

        pcm = apply_speed(pcm, speed)
        
        # Yield the raw PCM chunk directly
        yield pcm


# ---------------- API ---------------- #

@app.post("/v1/tts")
def tts(req: TTSRequest):

    if not req.text.strip():
        raise HTTPException(400, "Empty text")

    if req.voice not in AVAILABLE_VOICES:
        raise HTTPException(400, "Invalid voice")

    tone = TONE_PRESETS.get(req.tone, {})

    temperature = req.temperature or tone.get("temperature", DEFAULT_TEMPERATURE)
    top_p = req.top_p or tone.get("top_p", DEFAULT_TOP_P)
    rep_pen = req.repetition_penalty or DEFAULT_REP_PENALTY
    speed = req.speed or tone.get("speed", 1.0)

    # ---------------- BILLING CALCULATION ---------------- #
    # Count emotion tags like <gasp>, <laugh>, etc.
    emotion_tags = re.findall(r'<\w+>', req.text)
    emotion_tag_count = len(emotion_tags)

    # Billable character count = full text length (tags are part of the input cost)
    char_count = len(req.text)

    # Credit formula: 1 credit per character + 5 credits per emotion tag surcharge
    credits_deducted = char_count + (emotion_tag_count * 5)

    return StreamingResponse(
        generate_tts_stream(
            text=req.text,
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