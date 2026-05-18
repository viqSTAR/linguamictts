#!/bin/bash
# Serverless entrypoint: starts llama-cpp-server + uvicorn, then hands off
# to handler.py which RunPod drives as the job worker.
set -euo pipefail

MODEL_PATH="${ORPHEUS_MODEL_PATH:-/models/Orpheus-3b-FT-Q8_0.gguf}"
LLAMA_HOST="${LM_STUDIO_HOST:-127.0.0.1}"
LLAMA_PORT="${LM_STUDIO_PORT:-1234}"

if [ ! -f "$MODEL_PATH" ]; then
  echo "[start] FATAL: model not found at $MODEL_PATH"
  exit 1
fi

echo "[start] Launching llama-cpp-server (${LLAMA_HOST}:${LLAMA_PORT})"
python -m llama_cpp.server \
  --model "$MODEL_PATH" \
  --host "$LLAMA_HOST" \
  --port "$LLAMA_PORT" \
  --n_gpu_layers -1 \
  --n_ctx 2048 \
  --chat_format llama-2 \
  &
LLAMA_PID=$!

echo "[start] Waiting for llama-cpp-server..."
for i in $(seq 1 120); do
  if curl -fsS "http://${LLAMA_HOST}:${LLAMA_PORT}/v1/models" > /dev/null 2>&1; then
    echo "[start] llama-cpp-server ready (${i}s)"; break
  fi
  if ! kill -0 "$LLAMA_PID" 2>/dev/null; then
    echo "[start] FATAL: llama-cpp-server died"; exit 1
  fi
  sleep 1
done

echo "[start] Launching uvicorn on 0.0.0.0:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1 &
UVICORN_PID=$!

echo "[start] Waiting for uvicorn..."
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:8000/v1/voices" \
       -H "Authorization: Bearer ${FASTAPI_INTERNAL_KEY:-default_dev_key}" > /dev/null 2>&1; then
    echo "[start] uvicorn ready (${i}s)"; break
  fi
  if ! kill -0 "$UVICORN_PID" 2>/dev/null; then
    echo "[start] FATAL: uvicorn died"; exit 1
  fi
  sleep 1
done

echo "[start] Starting RunPod handler"
exec python handler.py
