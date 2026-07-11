# PocketCoder

An Android app that runs LLMs entirely on-device -- search Hugging Face,
download a GGUF model straight to your phone, and chat with it completely
offline. No PC, no Termux, no adb required to actually use the app; those were
part of an earlier developer-tool-shaped design (see
[`plan/IMPLEMENTATION_PLAN.md`](plan/IMPLEMENTATION_PLAN.md) and
[`plan/HUGGINGFACE_BROWSER_PLAN.md`](plan/HUGGINGFACE_BROWSER_PLAN.md) for
that history) that has since been replaced by native on-device inference.

## Architecture

```
app/       Expo (React Native) app -- the whole product. Downloads GGUF
           models directly from Hugging Face and runs them in-process via
           llama.rn (llama.cpp compiled natively into the app). No backend
           involved in running or downloading models.
backend/   Thin, stateless FastAPI service used only for Hugging Face
           search/browse (GET /api/huggingface/search, GET .../files).
           Has no database and no device affinity -- deployable anywhere.
```

## Prerequisites

- Node.js 20+, Python 3.12+ (backend only)
- Android Studio + SDK (the app needs a custom native build, not Expo Go,
  since `llama.rn` is a native module)
- A physical Android device or emulator, arm64 recommended

## App setup

```bash
cd app
npm install
npx expo prebuild --platform android   # generates the native android/ project
npx expo run:android                    # builds and installs on a connected device/emulator
```

Point **Settings → Hugging Face Search** at wherever the backend is running
(defaults to `http://localhost:8000`; use your machine's LAN IP if the app
runs on a separate physical device, or the deployed Render URL once hosted).

## Backend setup

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate        # .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload
```

- API docs: http://localhost:8000/docs
- Run tests: `pytest`
- Deploy: build via the included `Dockerfile` (e.g. on Render -- stateless,
  no persistent volume needed)

## Typical flow

1. **Home** -- shows this device's RAM and a suggested max model size.
2. **Models → Browse Hugging Face** -- search, see per-file size/quant and a
   compatibility badge (supported / can bottleneck / not supported) computed
   from your phone's own memory. Downloading a model flagged "not supported"
   requires an explicit two-step confirmation.
3. **Models** -- also supports **Import from Device** for a `.gguf` you
   already have (e.g. quantized yourself elsewhere and copied over).
4. **Projects** -- create a project, assign a downloaded model, tune
   inference parameters.
5. **Inference** -- chat with the model; runs fully on-device via `llama.rn`,
   history is saved locally per-project.

## Known limitations

- GGUF only (the format `llama.cpp`/`llama.rn` understand).
- No multimodal (image/audio) support yet -- `llama.rn` supports it via a
  separate "mmproj" projector file paired with the main model, but the
  download/import flow and chat UI don't handle that pairing yet.
- No Hugging Face account/curation features on the backend yet -- it's
  intentionally minimal for now.
