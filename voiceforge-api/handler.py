"""
RunPod Serverless Handler for Linguamic VoiceForge API.

Receives jobs from RunPod, forwards them to the local FastAPI (uvicorn),
and returns results. The local FastAPI + llama-cpp-server are started first
by start_serverless.sh before this process runs.

Supported actions:
  voices  → GET /v1/voices  → returns JSON
  tts     → POST /v1/tts   → returns base64-encoded WAV + billing headers
  stt     → POST /v1/stt   → returns transcription JSON
"""

import base64
import io
import os

import requests
import runpod

LOCAL_BASE = "http://127.0.0.1:8000"
INTERNAL_KEY = os.getenv("FASTAPI_INTERNAL_KEY", "default_dev_key")


def _auth():
    return {"Authorization": f"Bearer {INTERNAL_KEY}"}


# ---------------------------------------------------------------------------
# Action handlers
# ---------------------------------------------------------------------------

def _voices():
    r = requests.get(f"{LOCAL_BASE}/v1/voices", headers=_auth(), timeout=15)
    if r.status_code != 200:
        return {"error": f"voices failed ({r.status_code})", "detail": r.text[:400]}
    return r.json()


def _tts(inp):
    payload = {
        "text": inp.get("text", ""),
        "voice": inp.get("voice", "tara"),
    }
    for k in ("tone", "temperature", "top_p", "repetition_penalty", "speed"):
        if inp.get(k) is not None:
            payload[k] = inp[k]

    try:
        r = requests.post(
            f"{LOCAL_BASE}/v1/tts",
            headers={**_auth(), "Content-Type": "application/json"},
            json=payload,
            timeout=300,
        )
    except requests.Timeout:
        return {"error": "TTS timed out after 300 s"}

    if r.status_code != 200:
        return {"error": f"TTS failed ({r.status_code})", "detail": r.text[:400]}

    return {
        "audio_base64": base64.b64encode(r.content).decode("utf-8"),
        "content_type": "audio/wav",
        "credits_deducted": int(r.headers.get("x-credits-deducted", 0)),
        "char_count": int(r.headers.get("x-char-count", 0)),
        "emotion_tag_count": int(r.headers.get("x-emotion-tag-count", 0)),
        "tone": r.headers.get("x-tone", ""),
    }


def _stt(inp):
    audio_b64 = inp.get("audio_base64", "")
    filename = inp.get("filename", "audio.wav")
    if not audio_b64:
        return {"error": "audio_base64 is required for stt"}
    try:
        audio_bytes = base64.b64decode(audio_b64)
    except Exception:
        return {"error": "Invalid base64 in audio_base64"}

    try:
        r = requests.post(
            f"{LOCAL_BASE}/v1/stt",
            headers=_auth(),
            files={"file": (filename, io.BytesIO(audio_bytes), "audio/wav")},
            timeout=120,
        )
    except requests.Timeout:
        return {"error": "STT timed out after 120 s"}

    if r.status_code != 200:
        return {"error": f"STT failed ({r.status_code})", "detail": r.text[:400]}
    return r.json()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def handler(job):
    inp = job.get("input", {})
    action = inp.get("action", "")

    if action == "voices":
        return _voices()
    elif action == "tts":
        return _tts(inp)
    elif action == "stt":
        return _stt(inp)
    else:
        return {"error": f"Unknown action '{action}'. Use 'tts', 'stt', or 'voices'."}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
