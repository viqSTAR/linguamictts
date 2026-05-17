#!/bin/bash
# Two-process entrypoint for the RunPod image.
#
# Runs llama-cpp-python's OpenAI-compatible server (the LM Studio replacement)
# and uvicorn (the FastAPI wrapper) in the same container.
#
# Exit policy: if either process dies, we exit the whole container so RunPod
# restarts us. Don't try to be clever about restarting one without the other —
# the FastAPI process eagerly loads SNAC and Whisper at import time, and the
# llama server eagerly loads the GGUF model; partial restarts produce confusing
# half-up states.

set -euo pipefail

MODEL_PATH="${ORPHEUS_MODEL_PATH:-/models/orpheus-3b-0.1-ft-q4_k_m.gguf}"
LLAMA_HOST="${LM_STUDIO_HOST:-127.0.0.1}"
LLAMA_PORT="${LM_STUDIO_PORT:-1234}"

if [ ! -f "$MODEL_PATH" ]; then
  echo "[start] FATAL: Orpheus model not found at $MODEL_PATH"
  echo "[start] Either bake it into the image or mount a volume containing the GGUF file."
  exit 1
fi

echo "[start] Launching llama-cpp-server on ${LLAMA_HOST}:${LLAMA_PORT}"
echo "[start]   model: $MODEL_PATH"

# n_gpu_layers=-1 offloads the entire model to GPU. n_ctx 2048 matches what
# we configured for LM Studio. We disable the embeddings endpoint since
# Orpheus is a generation model.
python -m llama_cpp.server \
  --model "$MODEL_PATH" \
  --host "$LLAMA_HOST" \
  --port "$LLAMA_PORT" \
  --n_gpu_layers -1 \
  --n_ctx 2048 \
  --chat_format llama-2 \
  &
LLAMA_PID=$!

# Wait for the llama server to start listening. uvicorn boots fast and would
# otherwise race ahead and 502 the first request.
echo "[start] Waiting for llama-cpp-server to be ready..."
for i in $(seq 1 60); do
  if curl -fsS "http://${LLAMA_HOST}:${LLAMA_PORT}/v1/models" >/dev/null 2>&1; then
    echo "[start] llama-cpp-server ready (took ${i}s)"
    break
  fi
  if ! kill -0 "$LLAMA_PID" 2>/dev/null; then
    echo "[start] FATAL: llama-cpp-server died during startup. Check logs above."
    exit 1
  fi
  sleep 1
done

echo "[start] Launching FastAPI (uvicorn) on 0.0.0.0:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 &
UVICORN_PID=$!

# If either child dies, exit so RunPod respawns us cleanly.
wait -n "$LLAMA_PID" "$UVICORN_PID"
EXIT_CODE=$?
echo "[start] A child process exited (code $EXIT_CODE). Shutting down."
kill "$LLAMA_PID" "$UVICORN_PID" 2>/dev/null || true
exit "$EXIT_CODE"
