# PocketCoder — Phase 1 (v1.0 Core) Implementation Plan

## Context

`PocketCoder/PLAN.md` and `PLAN_1.md` describe a vision: turn the manual, notebook-driven on-device LLM deployment workflow in `ModelQuantize/github` (ADB → Termux → llama.cpp → CPU/Hexagon inference) into a proper GUI app — "the VS Code of on-device LLM deployment." `PocketCoder/` is currently empty except these two docs. The user confirmed:

- Build **Phase 1 / v1.0 Core only**: Project manager, Model manager, Deployment wizard, Diagnostics, Inference UI, Live logs. Benchmarks, embedded terminal, file explorer, plugins, AI assistant, and research mode are explicitly deferred.
- All new code goes under `PocketCoder/`. `ModelQuantize/github/` stays **read-only reference** — nothing there gets modified, and there's no importable Python in it (7 Jupyter notebooks + markdown docs only), so command logic must be reimplemented as real Python modules in the backend.
- Stack: **React Native (Expo)** frontend + **FastAPI** backend, matching the architecture diagram in both plan docs.

Ground-truth commands/behavior were extracted directly from `github/CPU/*` and `github/NPU/*` (README, Quick_Start_Guide, notebooks, research docs) and are baked into the Diagnostics/Wizard design below — including the one known, currently-unresolved NPU blocker (`libggml-htp-v81.so` ENOENT via FastRPC), which Diagnostics must explain rather than pretend to fix.

## Architecture

```
PocketCoder/
├── backend/                      FastAPI (Python), runs on the dev machine, owns the adb connection
│   └── app/
│       ├── main.py, config.py, deps.py, db.py
│       ├── core/
│       │   ├── command_runner.py     subprocess exec (argv lists, never shell=True), streaming + timeout/cancel
│       │   ├── process_registry.py   job_id -> running process, for stop/cancel
│       │   └── ring_buffer.py        in-memory log buffer + WebSocket pub/sub fanout
│       ├── services/
│       │   ├── adb_service.py        adb devices/push/shell/forward wrappers
│       │   ├── termux_service.py     pkg install / storage setup helpers
│       │   ├── deployment_service.py 5-step wizard state machine
│       │   ├── diagnostics_service.py doctor checks registry + runner
│       │   ├── model_service.py      local .gguf scan, GGUF header metadata, push/run/delete
│       │   ├── project_service.py    CRUD, SQLite-backed
│       │   ├── inference_service.py  relays phone's llama-server -> WebSocket token stream
│       │   └── log_service.py        structured log query/filter
│       ├── db_models/project.py      Project, PromptTemplate, HistoryEntry (SQLModel + SQLite)
│       ├── routers/                  projects, models, deployment, diagnostics, inference, devices, ws
│       └── utils/gguf_meta.py        pure-Python GGUF header reader (no llama.cpp bindings needed)
└── app/                           Expo (React Native)
    └── src/
        ├── navigation/            bottom tabs (Home/Projects/Models/Inference/Diagnostics) + drawer (Logs/Settings)
        ├── screens/               Home, Projects(+Detail), Models(+Detail), DeploymentWizard, Diagnostics, Inference, Logs, Settings
        ├── components/            DoctorCheckRow, WizardStep, ModelCard, ProjectCard, LogLine, TokenStreamView
        ├── api/                   fetch client + per-domain API modules + ws.ts
        └── theme/colors.ts        blue=CPU, orange=Hexagon, green=running, red=error, yellow=warning
```

## Key design decisions

1. **Command Runner is the safety spine.** All shell-out (adb, Termux via `adb shell`, llama.cpp build/run) goes through `command_runner.py` using `asyncio.create_subprocess_exec` with argv lists — never `shell=True`, never f-string command building. Remote Termux commands that must be a single shell string get every interpolated token through `shlex.quote()`, with numeric/enum params (threads, ctx, port) validated by Pydantic *before* they reach the runner. Long-running commands stream stdout/stderr line-by-line into the ring buffer and out over WebSocket, keyed by `job_id`, killable via `process_registry`.

2. **Diagnostics ("Doctor") checks, CPU-first, NPU honestly blocked.** Registry of ~13 checks: adb binary present → device connected → adb server responsive (auto-heals via kill-server/start-server) → Termux installed → storage permission → required packages (git/cmake/clang/make/python) → llama.cpp build artifacts present → build used the SVE/SME-crash-avoiding flags (`-DGGML_NATIVE=OFF -DGGML_CPU_ALL_VARIANTS=OFF`) → GGUF present on device → disk space. The NPU/Hexagon check is always informational-fail with a specific explanation (`ggml-hex: failed to open session 0 : error 0x80000406` → `libggml-htp-v81.so` ENOENT via FastRPC) instead of a generic error — it is a real unresolved upstream issue, not something Phase 1 claims to fix. A second check flags the specific `LD_LIBRARY_PATH` footgun (appending `/vendor/lib64:/system/lib64` breaks Android's linker entirely). "Fix Automatically" only wired for safe idempotent fixes (adb restart, re-run `termux-setup-storage`).

3. **Deployment Wizard is CPU-only for Phase 1**, 5 steps mapped 1:1 to real commands: install Termux (poll `pm list packages com.termux`) → install deps (`pkg install git cmake clang make python -y`) → deploy llama.cpp (on-device `git clone` + `cmake -B build -DGGML_NATIVE=OFF -DGGML_CPU_ALL_VARIANTS=OFF && cmake --build build -j4`) → configure environment (no-op for CPU, placeholder for future NPU env vars) → run diagnostics (gates "Launch Model"). NPU appears only as a greyed-out "Experimental, blocked" row linking to the Diagnostics explanation.

4. **Model Manager assumes BYO-GGUF for Phase 1** (no HF download/convert/quantize orchestration — that needs heavy host-side tooling: torch, sentencepiece, multi-GB downloads, and both vision docs already place it in later phases). Scope: scan a local models folder for `.gguf` files, parse metadata (quant type from filename + real GGUF header via `utils/gguf_meta.py`), and support push/run/delete/info per model card.

5. **Projects persist in SQLite** (SQLModel), not JSON files — relational shape (project → history entries → prompt templates) needs atomic writes and filterable history as it grows; still a single local file, no server dependency.

6. **Inference streams through the backend, not directly to the phone.** Backend maintains `adb forward tcp:8080 tcp:8080` and talks to `127.0.0.1:8080` (the phone's `llama-server`, OpenAI-compatible), relaying SSE chunks to the Expo app over `/ws/inference/{job_id}`. This keeps the "USB-first, no Wi-Fi required" UX — the Expo app only ever talks to the FastAPI backend — and centralizes history-writing.

7. **Live Logs**: every command/diagnostic/wizard/inference event is tagged (CPU/NPU/DSP/FastRPC/OpenCL/System) and level (INFO/WARNING/ERROR) at the point of emission, held in a bounded in-memory ring buffer for instant WebSocket tail, and also appended to a rotating JSON-lines file for search/export beyond in-memory history.

## Build order (this session)

1. Backend skeleton (`main.py`, config, empty routers) — confirm `uvicorn` boots and `/docs` renders.
2. `command_runner.py` + `adb_service.py` — validate against `adb version`/`adb devices` on the real dev machine.
3. Devices router + `/ws/logs` plumbing — first true vertical slice (real adb → real WebSocket).
4. Diagnostics service + screen (checks that don't need Termux pre-configured first, expand from there).
5. Deployment Wizard service + screen.
6. Model Manager (host-side `.gguf` scan is device-independent, buildable/testable immediately).
7. Project Manager + SQLite (parallelizable with 3–6).
8. Inference streaming (depends on a working deployed `llama-server`; last, since it's the deepest dependency chain).
9. Logs polish (file persistence, filters, search).
10. Expo navigation/theme pass, wired to real endpoints incrementally.

Given the size, I'll work through this in order and check in at natural milestones (e.g. after the backend skeleton + diagnostics vertical slice, and again once the Wizard/Model Manager/Inference pieces are up) rather than silently building everything before showing you anything.

## Verification

- Backend: `uvicorn app.main:app --reload` boots cleanly, `/docs` (OpenAPI) lists all routers; unit tests for `command_runner` (argv-only invocation, no shell injection) and `diagnostics_service` (check registry logic) via `pytest`.
- With a physical Android phone connected over USB: run Diagnostics from the app and confirm it accurately reflects real device/Termux state; run the Deployment Wizard end-to-end and confirm llama.cpp actually builds on-device; push a real `.gguf`, launch inference, and confirm token streaming appears live in the Inference screen and a HistoryEntry is persisted.
- Expo app: `npx expo start`, exercise navigation across all Phase 1 screens against the running backend (not just mocked data) before calling any screen "done."
