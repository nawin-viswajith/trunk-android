# Hugging Face Model Browser + Device Compatibility Check

## Context

PocketCoder's Model Manager currently only supports BYO-GGUF (drop a file into `backend/workspace/models/`, push to device). The user wants to browse/search Hugging Face for GGUF models from inside the app and download them directly, with the backend checking the file size against the connected phone's actual RAM *before* download and flagging one of three tiers: **supported**, **can bottleneck**, or **not supported (OOM)**.

Clarified with the user: this is a **native browse/search screen backed by Hugging Face's public API**, not a literal embedded WebView browser — avoids adding a new native module (`react-native-webview`, which could hit the same "incompatible with Expo Go" wall Reanimated did) and avoids fragile download-interception from an arbitrary webpage. Verified live against the real HF API during planning:
- `GET https://huggingface.co/api/models?search={q}&filter=gguf&sort=downloads&direction=-1&limit=25` → repo search results (id, downloads, likes).
- `GET https://huggingface.co/api/models/{repo_id}/tree/main` → per-file `{path, size}` in bytes, including split shards like `-00001-of-00002.gguf`. We list only single-file `.gguf` entries (filter out `-\d+-of-\d+\.gguf$`) to avoid multi-part download/merge complexity for this pass.
- Actual download URL: `https://huggingface.co/{repo_id}/resolve/main/{filename}`.

Compatibility is inherently a **heuristic** (file size vs. phone RAM) — there's no way to precisely predict llama.cpp's runtime memory use without knowing full architecture details and exact backend behavior. The plan documents the heuristic clearly rather than pretending it's exact, consistent with how Diagnostics already treats the NPU/Hexagon limitation honestly.

## Backend

**New: `app/services/compatibility_service.py`** (device-RAM-vs-model-size heuristic, kept separate from HF networking code since it's reusable/independently testable):
- `get_device_memory_mb(serial) -> DeviceMemory` — `adb_service.shell(["cat", "/proc/meminfo"])`, parse `MemTotal:`/`MemAvailable:` (kB → MB). Returns `None` fields if no device/parse failure.
- `estimate_required_mb(file_size_bytes) -> float` — heuristic: `file_size_mb * 1.2 + 512` (fixed overhead approximates compute buffers + KV cache at our app's fixed 2048 context). Documented in a docstring as an approximation, not an exact model.
- `categorize(required_mb, available_mb) -> "supported" | "can_bottleneck" | "not_supported"` — `required <= 0.6×available` → supported; `required <= available` → can_bottleneck; else not_supported.
- `check_compatibility(file_size_bytes, serial) -> CompatibilityResult` (pydantic: category incl. a 4th `"unknown"` state when no device is connected, required_mb, available_mb, total_mb, message). `"unknown"` doesn't block download, it just means we can't warn yet.

**New: `app/services/huggingface_service.py`**:
- `search_models(query, limit=25) -> list[HfModelSummary]` — calls the search endpoint above via `httpx`.
- `list_gguf_files(repo_id) -> list[HfGgufFile]` — calls the tree endpoint, filters to non-split `.gguf` paths, reuses **existing** `quant_from_filename()` from `app/utils/gguf_meta.py` (no new quant-parsing logic).
- `download_file(repo_id, filename, job_id, serial)` — background task: `shutil.disk_usage(settings.models_dir)` guard (host disk space -- separate concern from phone RAM, no adb needed), then streams via `httpx.AsyncClient().stream("GET", url)` into `settings.models_dir / filename` (same directory BYO-GGUF already uses -- unifies both paths, `model_service.list_models()` needs zero changes to pick up HF-downloaded files), publishing throttled (~every 500ms) `{type:"progress", downloaded_bytes, total_bytes}` frames to a dedicated `Broadcaster` (same pattern as `inference_service.frame_broadcaster` / `routers/diagnostics.py`'s `check_broadcaster`), then `{type:"done"}` or `{type:"error", message}`.
- Cancellation: module-level `dict[job_id, asyncio.Event]`, checked each chunk in the download loop; `cancel_download(job_id)` sets it and deletes the partial file.

**New: `app/models/huggingface.py`** — `HfModelSummary`, `HfGgufFile` (includes nested `CompatibilityResult`), `HfDownloadRequest` pydantic schemas.

**New: `app/routers/huggingface.py`**:
- `GET /api/huggingface/search?q=`
- `GET /api/huggingface/models/{repo_id:path}/files?serial=` — list_gguf_files + compatibility check attached per file in one response (so the UI has size + tier before any tap)
- `POST /api/huggingface/download` `{repo_id, filename, serial}` → background task, returns `{job_id}` immediately (same fire-and-return pattern as `routers/deployment.py`)
- `POST /api/huggingface/download/{job_id}/cancel`

**`app/routers/ws.py`**: add `/ws/huggingface/{job_id}`, mirroring the existing history-replay-then-subscribe pattern already used for diagnostics/deployment/inference.

**`app/main.py`**: register the new router.

## Frontend

- **`app/src/api/huggingface.ts`** — search, listFiles, download, cancel, matching existing `api/*.ts` conventions.
- **`app/src/components/CompatibilityBadge.tsx`** — flat, sharp-edged badge reusing existing color tokens from `theme/colors.ts` (no new colors): supported→`colors.running` (green), can_bottleneck→`colors.warning` (yellow), not_supported→`colors.error` (red), unknown→`colors.textSecondary` (gray).
- **`app/src/screens/HuggingFaceSearchScreen.tsx`** — search input + `FlatList` of repo results (id, downloads, likes).
- **`app/src/screens/HuggingFaceFilesScreen.tsx`** — file list per repo with size + `CompatibilityBadge` inline; tapping a file shows a confirmation `Alert` whose severity matches the tier (a plain confirm for supported/can_bottleneck, an explicit "this will likely crash from OOM, download anyway?" wording for not_supported); on confirm, starts the download and shows a progress bar reading from `/ws/huggingface/{job_id}`.
- **`app/src/navigation/RootNavigator.tsx`**: convert the `Models` tab from a bare screen into its own stack (mirroring the existing `ProjectsStackNavigator` pattern) with screens named `"Models List"` → `"Browse Hugging Face"` → `"Hugging Face Files"` (distinct names throughout, avoiding the nested-same-name warning we already fixed once for Projects).
- **`app/src/screens/ModelsScreen.tsx`**: add a "Browse Hugging Face" action navigating into the new stack screens.

## Verification

- Backend: unit tests for `compatibility_service` (categorization thresholds, meminfo parsing) and `huggingface_service` (split-shard filtering, quant parsing reuse) using `monkeypatch` on `adb_service`/`httpx`, matching existing test conventions in `backend/tests/`. Since HF's real API is reachable from this environment, one lightweight integration-style test can hit the real search endpoint to guard against API shape drift (skippable if offline).
- Manual: search for a real model (e.g. "qwen2.5-coder"), confirm file list shows real sizes and a compatibility tier once a phone is connected (cross-check the category against the phone's actual `/proc/meminfo` via `adb shell cat /proc/meminfo`), download a small file end-to-end, confirm it then appears in the existing Models screen and can be pushed to the device via the existing Push action.
