# Migrating voiceforge-api to RunPod

**Audience:** Abhishek
**Owner after migration:** Abhishek
**Estimated effort:** half a day to a day

## Why this exists

Today the LinguaMic TTS pipeline runs on Vikashdeep's laptop:

```
User → Render (backend) → ngrok tunnel → Vikashdeep's laptop
                                            ├── Docker (voiceforge-api FastAPI :8000)
                                            └── LM Studio (Orpheus GGUF :1234)
```

If his laptop sleeps, the whole product is offline. We need this on real cloud
infra. RunPod is the cheapest reasonable host for GPU workloads in 2026
(~$0.30–0.80/hr for an RTX 4000-class card, less than half what Lambda/AWS
charge for equivalent silicon).

The blocker is **LM Studio is a desktop GUI app** — it cannot run headless on
a Linux server. So the migration is really two changes glued together:

1. **Replace LM Studio with a headless GGUF server** (drop-in, same API shape).
2. **Repackage the FastAPI service** to run as one container on RunPod.

Code-side this is small. The work is mostly Docker + RunPod console.

---

## Recommended architecture

```
User → Render (backend) → https://<runpod-pod-id>-8000.proxy.runpod.net
                                       │
                                       ▼
                          RunPod GPU Pod (one container)
                          ├── uvicorn main:app :8000        (the existing FastAPI)
                          │   └── faster-whisper "base"     ← STT runs HERE, in-process
                          └── python -m llama_cpp.server :1234
                                                            (drop-in for LM Studio)
```

One container, two processes, started by a tiny shell entrypoint. Pod stays
warm. The FastAPI code does **not** change — it already talks HTTP to
`localhost:1234/v1/completions`, which is exactly what `llama-cpp-python`'s
server exposes.

**STT clarification:** Whisper is not a separate server. `main.py:17-25` loads
`faster_whisper.WhisperModel("base", ...)` at module import time, and the
`/v1/stt` endpoint calls it directly via Python. It shares the same GPU as the
TTS path. No extra process, no extra port. The Dockerfile pre-caches the model
at build time so the first STT request doesn't pay a 140 MB download.

### Pod vs Serverless — pick Pod first

| | RunPod Pod | RunPod Serverless |
|---|---|---|
| Cold start | None (stays warm) | 30–90s per cold worker (Orpheus 3B GGUF + SNAC + Whisper) |
| Cost when idle | Full hourly rate | $0 |
| Cost when busy | Hourly rate | Per-second billing, usually cheaper |
| UX on first request | Instant | Bad (long wait) |

For an early-stage product where every demo needs to feel snappy, **start with
a Pod.** Move to Serverless once you have predictable traffic and can stomach
cold starts (or pay for "active workers" to keep one always warm — which
defeats most of the cost saving).

GPU recommendation for the Pod: **RTX 4000 Ada / 4090 / A4000** — anything
with 12+ GB VRAM. The 3B GGUF Q4_K_M is ~2 GB; SNAC is small; Whisper base is
small. Plenty of headroom on a 16 GB card.

---

## Step-by-step migration

### 1. Build the new Docker image

The current `Dockerfile` assumes LM Studio is reachable on the host via
`host.docker.internal`. We need a version where llama-cpp-python is **inside**
the container.

Two ready-to-use files have been created for this migration:

- **`voiceforge-api/Dockerfile.runpod`** — the new production image
- **`voiceforge-api/start.sh`** — the two-process entrypoint

What they do, at a glance:

- Same `pytorch/pytorch:2.7.0-cuda12.8-cudnn9-runtime` base (works on RTX 40xx
  and Blackwell sm_120, same as today).
- Installs `llama-cpp-python[server]==0.3.2` built with CUDA
  (`CMAKE_ARGS="-DGGML_CUDA=on"`). This is the drop-in LM Studio replacement.
- Installs `faster-whisper==1.0.3` for STT (loaded in-process by main.py).
- Downloads the Orpheus Q4_K_M GGUF model at build time into
  `/models/orpheus-3b-0.1-ft-q4_k_m.gguf` (~2 GB).
- Pre-fetches the Whisper "base" model at build time so the first STT request
  isn't a cold 140 MB download.
- `start.sh` boots `llama_cpp.server` on `127.0.0.1:1234`, waits for its
  `/v1/models` endpoint to respond, then boots uvicorn on `0.0.0.0:8000`.
  If either child dies the whole container exits — RunPod respawns it.

**Optional optimization:** baking the 2 GB GGUF into the image makes builds
slow but cold starts predictable. If you'd rather mount a RunPod network
volume at `/models` and download once, delete the `RUN wget ...` block in
`Dockerfile.runpod` and add `-v <volume>:/models` in the Pod config.

### 2. Local test before pushing

On a Linux box with an NVIDIA GPU (or WSL2 with nvidia-container-toolkit):

```bash
cd voiceforge-api
docker build -f Dockerfile.runpod -t linguamic-tts:runpod .
docker run --rm --gpus all -p 8000:8000 \
  -e FASTAPI_INTERNAL_KEY=test-key \
  linguamic-tts:runpod
```

In another terminal:
```bash
curl -X POST http://localhost:8000/v1/tts \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from RunPod","voice":"tara"}' \
  --output test.wav
```

If `test.wav` plays, the container is correct. If not, check logs — most
likely cause is llama-cpp-python failing to find CUDA, or the model file not
landing in `/models/`.

### 3. Push the image somewhere RunPod can pull

GitHub Container Registry is free for public images:

```bash
docker tag linguamic-tts:runpod ghcr.io/viqstar/linguamic-tts:runpod
echo $GITHUB_TOKEN | docker login ghcr.io -u viqstar --password-stdin
docker push ghcr.io/viqstar/linguamic-tts:runpod
```

Or Docker Hub. Either works.

### 4. Provision the RunPod Pod

In the RunPod console → "GPU Cloud" → "Deploy":

- **GPU:** RTX 4000 Ada (or any 16 GB card you can find at a good rate)
- **Template:** "Custom" → enter your image (`ghcr.io/viqstar/linguamic-tts:runpod`)
- **Container Disk:** 20 GB (the model is in the image, container can be slim)
- **Volume:** 10 GB at `/cache` (for Whisper to cache its base model between restarts)
- **Expose HTTP:** 8000
- **Env variables:**
  ```
  FASTAPI_INTERNAL_KEY = <generate a strong random string — store this>
  LM_STUDIO_HOST       = 127.0.0.1
  LM_STUDIO_PORT       = 1234
  ```
- **Start:** Click deploy.

After ~2 minutes RunPod gives you a public URL like
`https://abc123-8000.proxy.runpod.net`. That's your new FastAPI endpoint.

### 5. Smoke test the public endpoint

Test all three endpoints — TTS, STT, and voices listing — since they all live
in the same container and you want to confirm both paths (llama-cpp + Whisper)
work before cutting over.

```bash
# 5a — voices (cheap, validates auth + uvicorn)
curl https://<your-pod-id>-8000.proxy.runpod.net/v1/voices \
  -H "Authorization: Bearer <FASTAPI_INTERNAL_KEY>"

# 5b — TTS (validates llama-cpp-server + SNAC decoder)
curl -X POST https://<your-pod-id>-8000.proxy.runpod.net/v1/tts \
  -H "Authorization: Bearer <FASTAPI_INTERNAL_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"text":"Production smoke test","voice":"tara"}' \
  --output prod-test.wav

# 5c — STT (validates faster-whisper, uses the wav we just generated)
curl -X POST https://<your-pod-id>-8000.proxy.runpod.net/v1/stt \
  -H "Authorization: Bearer <FASTAPI_INTERNAL_KEY>" \
  -F "file=@prod-test.wav"
```

Expected: 5a returns `{"voices":[...], "tones":[...], "emotions":[...]}`,
5b produces a playable wav, 5c returns JSON like
`{"text":"Production smoke test","duration":1.8}`.

If all three pass, you're done with the migration. Move on to step 6.

### 6. Cut over the backend

On Render → `linguamic-backend` → Environment → update:

| Key | Old value | New value |
|---|---|---|
| `FASTAPI_URL` | `https://overcaptious-noelle-malarian.ngrok-free.dev` | `https://<your-pod-id>-8000.proxy.runpod.net` |
| `FASTAPI_INTERNAL_KEY` | (current laptop value) | (the value you set on RunPod in step 4) |

Save → Render auto-redeploys. Test a real TTS generation from `linguamic.com/studio`.

### 7. Decommission the laptop setup

Once production has been stable on RunPod for a day:

- Tell Vikashdeep he can stop running `START TTS SERVER.bat`.
- Cancel the ngrok reserved domain if it's a paid one.
- Keep the Docker image building locally for dev — it's still useful.

---

## Things to fix while you're in there

These are small, known issues from the prior audit. Easiest to do them as part
of this migration since you're already touching the same files.

1. **Add a request timeout** in `voiceforge-api/gguf_orpheus.py` line ~69:
   ```python
   response = requests.post(API_URL, headers=HEADERS, json=payload, stream=True, timeout=(5, 180))
   ```
   Without this, if llama-cpp-server hangs, the FastAPI worker blocks forever.

2. **Pin the orpheus-tts-local clone** in the Dockerfile. Today's line 22 is:
   ```dockerfile
   RUN git clone --depth=1 https://github.com/isaiahbjork/orpheus-tts-local /orpheus-tts-local
   ```
   Pin a commit SHA so an upstream rename doesn't silently break the build:
   ```dockerfile
   RUN git clone https://github.com/isaiahbjork/orpheus-tts-local /orpheus-tts-local \
       && cd /orpheus-tts-local && git checkout <sha>
   ```

3. **Remove the `2>/dev/null || true` mask** on `pip install -r requirements.txt`
   (Dockerfile line ~44). Right now it swallows the exact errors we'd need to
   see if a transitive dep ever downgrades torch and breaks sm_120 support.

4. **WAV header sizes are placeholders** (`\xff\xff\xff\xff`) in `main.py:369-377`.
   Chrome/Firefox accept this; Safari/iOS sometimes don't. If iPhone users
   report broken audio, this is the cause. Fix is to buffer the full PCM
   before emitting the WAV, but that loses streaming — accept the tradeoff or
   ship a real chunked WAV header.

5. **Upgrade Whisper from `base` to `small`** if you want stronger STT
   accuracy (`main.py:21`). `small` is ~5x slower but noticeably better.
   `base` is fine for short transcripts.

---

## How to roll back

If RunPod misbehaves and you need to revert:

1. On Render → `linguamic-backend` → Environment → change `FASTAPI_URL` back
   to the ngrok URL (`https://overcaptious-noelle-malarian.ngrok-free.dev`)
   and restore `FASTAPI_INTERNAL_KEY` to the laptop's value.
2. Vikashdeep starts the .bat file again.
3. Save on Render → auto-redeploy.

That's it. The backend is the only thing that needs to know where TTS lives.

---

## Future: Serverless migration

Once traffic is steady and you want to cut costs at idle:

- Wrap the same image as a RunPod Serverless worker (different deploy flow,
  same Docker image).
- Set `min_workers=0`, `max_workers=N`, `idle_timeout=5s`.
- Add an "active worker" of 1 if cold starts become a UX problem, or accept
  that the first user every few minutes gets a 30-60s wait.
- Update `FASTAPI_URL` on Render to the Serverless endpoint.

Don't do this until you have at least a few hundred requests/day of real
traffic — without that, the Pod's flat hourly cost is likely cheaper than the
"keep one worker warm" overhead anyway.

---

## Cost estimate

Single RTX 4000 Ada Pod, 24/7: ~$0.34/hr × 720h = **~$245/month**.
Single RTX 4090 Pod, 24/7: ~$0.69/hr × 720h = **~$500/month**.

RunPod's "Secure Cloud" is more reliable but ~30% more expensive than their
"Community Cloud". Start on Community Cloud, upgrade if you see instability.

---

## Files relevant to this migration

| File | Role |
|---|---|
| `voiceforge-api/Dockerfile.runpod` | New, headless image (created with this doc) |
| `voiceforge-api/start.sh` | New, two-process entrypoint |
| `voiceforge-api/main.py` | Unchanged — already talks to localhost:1234 |
| `voiceforge-api/gguf_orpheus.py` | Add the `timeout=` fix, otherwise unchanged |
| `voiceforge-api/Dockerfile` | Keep as-is for local dev with LM Studio |
| `voiceforge-api/docker-compose.yml` | Keep as-is for local dev |
| `voiceforge-backend/render.yaml` | No change needed; env vars are already declared |

Backend code requires **zero changes**. The whole migration is infrastructure.
