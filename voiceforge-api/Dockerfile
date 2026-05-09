# ─────────────────────────────────────────────────────────────────────────────
# VoiceForge API — Docker Image (GPU / Production)
# Base: pytorch/pytorch 2.7.0 + CUDA 12.8 → supports RTX 5070 Ti (sm_120 Blackwell)
# ─────────────────────────────────────────────────────────────────────────────
FROM pytorch/pytorch:2.7.0-cuda12.8-cudnn9-runtime

# Prevent interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ffmpeg \
    libsndfile1 \
    libportaudio2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Clone orpheus-tts-local ───────────────────────────────────────────────────
RUN git clone --depth=1 https://github.com/isaiahbjork/orpheus-tts-local /orpheus-tts-local

# ── App directory ─────────────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
# NOTE: torch and torchaudio are PRE-INSTALLED in this base image (cu128).
# Do NOT reinstall torch here — it will downgrade/break sm_120 support.
RUN pip install --no-cache-dir \
    fastapi==0.115.0 \
    uvicorn[standard]==0.30.6 \
    python-multipart==0.0.12 \
    python-dotenv==1.0.1 \
    numpy \
    soundfile \
    snac \
    requests \
    scipy \
    sounddevice \
    faster-whisper

# orpheus-tts-local requirements (best-effort; torch already installed above)
RUN pip install --no-cache-dir -r /orpheus-tts-local/requirements.txt 2>/dev/null || true

# ── Copy application ──────────────────────────────────────────────────────────
COPY main.py .

# ── Environment ───────────────────────────────────────────────────────────────
ENV ORPHEUS_TTS_LOCAL_PATH=/orpheus-tts-local
ENV PYTHONPATH=/orpheus-tts-local
# LM Studio runs on your Windows host — Docker Desktop resolves host.docker.internal
ENV LM_STUDIO_HOST=host.docker.internal
ENV LM_STUDIO_PORT=1234
ENV TRANSFORMERS_CACHE=/cache/huggingface
ENV HF_HOME=/cache/huggingface

# ── Expose & run ─────────────────────────────────────────────────────────────
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
