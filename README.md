# PocketCoder

A GUI development environment for deploying and running local LLMs on Android
via ADB, Termux, and llama.cpp -- built on top of the manual workflow
documented in [`../github`](../github). Phase 1 (v1.0 Core): Project Manager,
Model Manager, Deployment Wizard, Diagnostics ("Doctor"), Inference, and Live
Logs. See [`plan/IMPLEMENTATION_PLAN.md`](plan/IMPLEMENTATION_PLAN.md) for the
full design and [`plan/thingsToNote.md`](plan/thingsToNote.md) for known
caveats.

## Architecture

```
app/       Expo (React Native) frontend -- bottom-tab nav + drawer (Logs/Settings)
backend/   FastAPI backend -- owns the adb connection, shells out to
           adb/Termux/llama.cpp, exposes REST + WebSocket APIs
```

The backend runs on your dev machine and owns the USB/adb connection to the
phone. The Expo app only ever talks to the backend, never directly to the
phone.

## Prerequisites

- Python 3.12+
- Node.js 20+
- Android Platform Tools (`adb`) -- update the path in `backend/.env` if it
  isn't at the default location
- An Android phone with USB debugging enabled, Termux (from
  [F-Droid/GitHub releases](https://github.com/termux/termux-app/releases),
  not the outdated Play Store build) and Termux:API installed, with
  `allow-external-apps = true` set in `~/.termux/termux.properties` (required
  so the backend can run setup/build commands inside Termux -- Diagnostics
  will flag this if missing)

## Backend setup

```bash
cd backend
python -m venv .venv
./.venv/Scripts/activate        # .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
cp .env.example .env            # adjust ADB_PATH etc. if needed
uvicorn app.main:app --reload
```

- API docs: http://localhost:8000/docs
- Run tests: `pytest`
- Drop `.gguf` model files into `backend/workspace/models/` for the Model
  Manager to pick them up

## App setup

```bash
cd app
npm install
npx expo start
```

Open the app in Expo Go (or a dev client) on your phone/emulator, then set the
backend URL in **Settings** to point at the machine running the FastAPI
backend (e.g. `http://192.168.1.50:8000` if the app runs on a separate
device from the backend, or `http://localhost:8000` if running in an
Android emulator on the same machine via `adb reverse`).

## Typical flow

1. **Settings** -- confirm the backend URL and select your connected device.
2. **Diagnostics** -- run a full check; fix anything it flags before continuing.
3. **Deployment Wizard** -- install Termux, install dependencies, deploy and
   build llama.cpp on-device (CPU backend only in Phase 1).
4. **Models** -- push a local `.gguf` file to the device.
5. **Projects** -- create a project and assign it a model.
6. **Inference** -- chat with the model; token stream and history are saved
   per-project.
7. **Logs** -- live, filterable (CPU/NPU/DSP/FastRPC/OpenCL/System) tail of
   everything the backend has run.

## Known limitations (Phase 1)

- NPU/Hexagon backend is intentionally not offered as a working path --
  Diagnostics explains the current upstream blocker
  (`libggml-htp-v81.so` not found via FastRPC) instead of pretending to fix it.
- No in-app Hugging Face download/convert/quantize pipeline yet -- bring your
  own `.gguf` files.
- No benchmarking, embedded terminal, file explorer, or plugin system yet --
  planned for later phases.
