# ─────────────────────────────────────────────────────────────────────────────
# VoiceForge API — Docker Image
# Base: CUDA 12.6 (compatible with RTX 5070 Ti + RunPod GPU instances)
# Works: local Docker Desktop (Windows/Linux) + RunPod Serverless GPU
# ─────────────────────────────────────────────────────────────────────────────
FROM nvidia/cuda:12.6.0-cudnn-runtime-ubuntu22.04

# Prevent interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3.10-dev \
    python3-pip \
    git \
    ffmpeg \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Make python3 point to 3.10
RUN ln -sf /usr/bin/python3.10 /usr/bin/python3 && \
    ln -sf /usr/bin/python3.10 /usr/bin/python && \
    ln -sf /usr/bin/pip3 /usr/bin/pip

# ── Clone orpheus-tts-local (provides gguf_orpheus.py) ───────────────────────
RUN git clone --depth=1 https://github.com/isaiahbjork/orpheus-tts-local /orpheus-tts-local

# ── App directory ─────────────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
# PyTorch with CUDA 12.6
RUN pip install --no-cache-dir \
    torch \
    torchaudio \
    --index-url https://download.pytorch.org/whl/cu124

# Core app deps
RUN pip install --no-cache-dir \
    fastapi==0.115.0 \
    uvicorn[standard]==0.30.6 \
    python-multipart==0.0.12 \
    python-dotenv==1.0.1 \
    numpy \
    soundfile \
    snac

# STT — faster-whisper (downloads model on first run, cached in volume)
RUN pip install --no-cache-dir faster-whisper

# orpheus-tts-local requirements (best-effort — may overlap with above)
RUN pip install --no-cache-dir -r /orpheus-tts-local/requirements.txt 2>/dev/null || true

# ── Copy application ──────────────────────────────────────────────────────────
COPY main.py .
# .env is NOT copied — always pass at runtime via --env-file or environment vars

# ── Environment ───────────────────────────────────────────────────────────────
# Tell main.py where orpheus-tts-local lives
ENV ORPHEUS_TTS_LOCAL_PATH=/orpheus-tts-local

# On Windows Docker Desktop, host.docker.internal resolves to host machine
# LM Studio should be running on the host at port 1234
ENV LM_STUDIO_HOST=host.docker.internal
ENV LM_STUDIO_PORT=1234

# Whisper model cache — mount a volume here to avoid re-downloading
ENV TRANSFORMERS_CACHE=/cache/huggingface
ENV HF_HOME=/cache/huggingface

# ── Expose & run ─────────────────────────────────────────────────────────────
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
