# Trunk

**by TuskerLabs**

An Android app that runs LLMs entirely on-device - search Hugging Face,
download a GGUF model straight to your phone, and chat with it completely
offline. No cloud, no server, and no account required to use the app; nothing
you type is synced anywhere.

> Trunk is a proprietary product built by TuskerLabs. See [`LICENSE`](LICENSE)
> - this is not an open-source project.

## Architecture

```
app/       Expo (React Native) app - the whole product. Downloads GGUF
           models directly from Hugging Face and runs them in-process via
           llama.rn (llama.cpp compiled natively into the app). No backend
           involved in running or downloading models.
backend/   Thin, stateless FastAPI service used only for Hugging Face
           search/browse (GET /api/huggingface/search, GET .../files).
           Has no database and no device affinity - deployable anywhere.
docs/branding/   Source artwork and a high-resolution flattened master of
           the app icon, for store listings and press use (separate from
           the platform-specific icon files actually bundled in app/assets).
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
When developing against a USB-connected device, remember to forward both the
Metro and backend ports: `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8000 tcp:8000`.

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
- Deploy: build via the included `Dockerfile` (e.g. on Render - stateless,
  no persistent volume needed)

## Typical flow

1. **First launch** - a short intro, an explicit warning that chat data is
   device-only and unrecoverable if the app is removed, then a mandatory
   one-time setup step (theme, dark contrast, color palette, and whether to
   show per-response stats) before the app is usable.
2. **Home** - this device's RAM/storage, a suggested max model size, and
   library/analytics summaries.
3. **Models → Browse Hugging Face** - search (or browse a live "Popular"
   list), see per-file size/quant and a compatibility badge (supported / can
   bottleneck / not supported) computed from your phone's own memory.
   Downloading a model flagged "not supported" requires an explicit two-step
   confirmation. Also supports **Import from Device** for a `.gguf` you
   already have.
4. **Projects** - create a project, assign a downloaded model, tune
   inference parameters (temperature, top-p, top-k, context length, max
   tokens), and review per-session token/speed history. Hold a project or
   model tile to multi-select and bulk-delete.
5. **Inference** - chat with the model; runs fully on-device via `llama.rn`.
   Multiple chat sessions per project, prior turns are replayed as context,
   markdown (code blocks, inline code, bold/italic) renders in responses,
   and a project's model is only ever assigned from Project Detail.

Swipe left/right on any of the four main tabs (Home, Models, Projects,
Inference) to move between them, in addition to tapping the tab bar.

## Design system

Flat, sharp-edged UI (no gradients, no border-radius except a few deliberate
circles - FABs, palette swatches). Six built-in accent palettes plus a
Greyscale option and a custom hex picker, each independently tuned for light
and dark mode. Dark mode has two contrast levels: a standard dark grey and a
true OLED pitch-black. All of this is configurable from **Settings**, and
onboarding reuses the exact same picker so first-run setup and Settings never
drift apart.

## Known limitations

- GGUF only (the format `llama.cpp`/`llama.rn` understand).
- No multimodal (image/audio) support yet - `llama.rn` supports it via a
  separate "mmproj" projector file paired with the main model, but the
  download/import flow and chat UI don't handle that pairing yet.
- No Hugging Face account/curation features on the backend yet - it's
  intentionally minimal for now.
- Downloaded models aren't linked back to their source Hugging Face repo,
  so there's no in-app README/description view for a model once saved -
  only filename, quant, size, and date added.
