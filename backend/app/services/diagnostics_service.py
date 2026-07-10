from collections.abc import AsyncIterator

from app.models.diagnostics import CheckResult
from app.services import termux_service
from app.services.adb_service import adb_service

REQUIRED_PACKAGES = ["git", "cmake", "clang", "make", "python"]
REQUIRED_BINARIES = ["llama-cli", "llama-server", "llama-bench"]
EXPECTED_BUILD_FLAGS = "GGML_NATIVE=OFF;GGML_CPU_ALL_VARIANTS=OFF"

NPU_FIX_TEXT = (
    "NPU (Hexagon) backend is experimental and currently blocked upstream. "
    "Root cause: `ggml-hex: failed to open session 0 : error 0x80000406` -- the "
    "FastRPC/DSP loader cannot locate `libggml-htp-v81.so` "
    "(`dlerror: cannot open libggml-htp-v81.so errno 2 / ENOENT`). "
    "This is not a PocketCoder bug; the CPU backend is fully supported."
)

LD_LIBRARY_PATH_FIX_TEXT = (
    "If you've manually set LD_LIBRARY_PATH for Hexagon experiments, do not append "
    "/vendor/lib64 or /system/lib64 -- this breaks Android's linker system-wide for "
    "the shell session (symptom: `CANNOT LINK EXECUTABLE ... cannot locate symbol "
    '"_ZNSt3__113__hash_memoryEPKvm"` even for `ls`/`find`). Use only '
    "`LD_LIBRARY_PATH=$basedir/lib` and `ADSP_LIBRARY_PATH=$basedir/lib`, in a fresh shell."
)


async def check_adb_binary(serial: str | None) -> CheckResult:
    result = await adb_service.version()
    if result.ok and any("Android Debug Bridge" in line for line in result.stdout_lines):
        return CheckResult(id="adb_binary", label="ADB binary present", status="pass", detail=result.stdout_lines[0])
    return CheckResult(
        id="adb_binary",
        label="ADB binary present",
        status="fail",
        detail="adb executable not found or not responding",
        fix_hint="Install Android Platform Tools and set the path in Settings.",
    )


async def check_device_connected(serial: str | None) -> tuple[CheckResult, str | None]:
    devices = await adb_service.list_devices()
    active = next((d for d in devices if d.serial == serial), None) if serial else (devices[0] if devices else None)

    if active is None:
        return CheckResult(
            id="device_connected", label="Device connected", status="fail",
            detail="No device found via `adb devices`",
            fix_hint="Check the USB cable/driver, or enable Wireless debugging.",
        ), None
    if active.state == "unauthorized":
        return CheckResult(
            id="device_connected", label="Device connected", status="fail",
            detail=f"Device {active.serial} is unauthorized",
            fix_hint="Tap Allow on the phone's USB-debugging prompt, then re-run.",
        ), None
    if active.state != "device":
        return CheckResult(
            id="device_connected", label="Device connected", status="fail",
            detail=f"Device {active.serial} state is '{active.state}'",
            fix_hint="Reconnect the device and re-run diagnostics.",
        ), None
    return CheckResult(
        id="device_connected", label="Device connected", status="pass", detail=f"{active.serial} ({active.state})",
    ), active.serial


async def check_adb_server_responsive(serial: str | None) -> CheckResult:
    devices = await adb_service.list_devices()
    if devices:
        return CheckResult(id="adb_server", label="ADB server responsive", status="pass", detail="ok")
    await adb_service.restart_server()
    devices = await adb_service.list_devices()
    if devices:
        return CheckResult(
            id="adb_server", label="ADB server responsive", status="warn",
            detail="adb server was unresponsive; restarted automatically",
            fix_hint="Re-run diagnostics to confirm the device now shows up.",
            can_auto_fix=True,
        )
    return CheckResult(
        id="adb_server", label="ADB server responsive", status="fail",
        detail="No devices found even after restarting the adb server",
    )


async def check_termux_installed(serial: str | None) -> CheckResult:
    installed = await termux_service.is_termux_installed(serial)
    if installed:
        return CheckResult(id="termux_installed", label="Termux installed", status="pass", detail="com.termux present")
    return CheckResult(
        id="termux_installed", label="Termux installed", status="fail",
        detail="com.termux package not found",
        fix_hint="Install Termux from https://github.com/termux/termux-app/releases (not the outdated Play Store build).",
    )


async def check_termux_external_apps(serial: str | None) -> CheckResult:
    job_id = await termux_service.run_command("echo pocketcoder_ok", serial)
    exit_code, output = await termux_service.wait_for_job(job_id, serial, poll_interval=1.5, timeout=15)
    if exit_code == 0 and "pocketcoder_ok" in output:
        return CheckResult(id="termux_external_apps", label="Termux allows external commands", status="pass", detail="RUN_COMMAND ok")
    return CheckResult(
        id="termux_external_apps", label="Termux allows external commands", status="fail",
        detail="RUN_COMMAND intent did not complete",
        fix_hint=(
            "Install Termux:API, then set `allow-external-apps = true` in "
            "~/.termux/termux.properties inside Termux and restart it. Required for "
            "PocketCoder to run setup/build commands without you typing them manually."
        ),
    )


async def check_storage_permission(serial: str | None) -> CheckResult:
    job_id = await termux_service.run_command("termux-setup-storage; ls ~/storage/downloads", serial)
    exit_code, _ = await termux_service.wait_for_job(job_id, serial, timeout=30)
    if exit_code == 0:
        return CheckResult(id="storage_permission", label="Termux storage permission", status="pass", detail="~/storage/downloads accessible")
    return CheckResult(
        id="storage_permission", label="Termux storage permission", status="fail",
        detail="~/storage/downloads not accessible",
        fix_hint="Re-run `termux-setup-storage` inside Termux and accept the permission prompt.",
    )


async def check_required_packages(serial: str | None) -> CheckResult:
    cmd = " && ".join(f"command -v {pkg}" for pkg in REQUIRED_PACKAGES)
    job_id = await termux_service.run_command(cmd, serial)
    exit_code, output = await termux_service.wait_for_job(job_id, serial, timeout=20)
    if exit_code == 0:
        return CheckResult(id="required_packages", label="Required packages installed", status="pass", detail=", ".join(REQUIRED_PACKAGES))
    return CheckResult(
        id="required_packages", label="Required packages installed", status="fail",
        detail=output.strip() or "one or more packages missing",
        fix_hint=f"Run `pkg install {' '.join(REQUIRED_PACKAGES)} -y` (Deployment Wizard Step 2).",
    )


async def check_llama_cpp_built(serial: str | None) -> CheckResult:
    cmd = " && ".join(f"test -f ~/llama.cpp/build/bin/{b}" for b in REQUIRED_BINARIES)
    job_id = await termux_service.run_command(cmd, serial)
    exit_code, _ = await termux_service.wait_for_job(job_id, serial, timeout=20)
    if exit_code == 0:
        return CheckResult(id="llama_cpp_built", label="llama.cpp build artifacts present", status="pass", detail=", ".join(REQUIRED_BINARIES))
    return CheckResult(
        id="llama_cpp_built", label="llama.cpp build artifacts present", status="fail",
        detail="one or more binaries missing under ~/llama.cpp/build/bin/",
        fix_hint="Run Deployment Wizard Step 3 to clone and build llama.cpp on-device.",
    )


async def check_build_flags(serial: str | None) -> CheckResult:
    job_id = await termux_service.run_command("cat ~/llama.cpp/build/.pocketcoder_build_flags", serial)
    exit_code, output = await termux_service.wait_for_job(job_id, serial, timeout=15)
    if exit_code == 0 and EXPECTED_BUILD_FLAGS in output:
        return CheckResult(id="build_flags", label="Build used SVE/SME-safe flags", status="pass", detail=EXPECTED_BUILD_FLAGS)
    return CheckResult(
        id="build_flags", label="Build used SVE/SME-safe flags", status="warn",
        detail="Could not confirm -DGGML_NATIVE=OFF -DGGML_CPU_ALL_VARIANTS=OFF was used",
        fix_hint=(
            "Without these flags, llama.cpp can crash with `clang frontend command failed "
            "(exit 139)` on-device (an LLVM SVE/SME code-gen bug). Rebuild via Deployment "
            "Wizard Step 3, which always sets them."
        ),
    )


async def check_gguf_present(serial: str | None) -> CheckResult:
    result = await adb_service.shell(["ls", "/sdcard/Download/"], serial=serial)
    gguf_files = [line for line in result.stdout_lines if line.endswith(".gguf")]
    if gguf_files:
        return CheckResult(id="gguf_present", label="GGUF model present on device", status="pass", detail=", ".join(gguf_files))
    return CheckResult(
        id="gguf_present", label="GGUF model present on device", status="fail",
        detail="No .gguf files found in /sdcard/Download/",
        fix_hint="Push a model from Model Manager.",
    )


async def check_disk_space(serial: str | None, min_free_mb: int = 2048) -> CheckResult:
    result = await adb_service.shell(["df", "/sdcard"], serial=serial)
    if len(result.stdout_lines) < 2:
        return CheckResult(id="disk_space", label="Free storage", status="warn", detail="Could not parse `df` output")
    fields = result.stdout_lines[1].split()
    try:
        available_kb = int(fields[3])
    except (IndexError, ValueError):
        return CheckResult(id="disk_space", label="Free storage", status="warn", detail="Could not parse `df` output")
    available_mb = available_kb // 1024
    if available_mb >= min_free_mb:
        return CheckResult(id="disk_space", label="Free storage", status="pass", detail=f"{available_mb} MB free")
    return CheckResult(
        id="disk_space", label="Free storage", status="fail",
        detail=f"Only {available_mb} MB free",
        fix_hint="Free up storage before pushing large models.",
    )


async def check_npu_backend(serial: str | None) -> CheckResult:
    return CheckResult(id="npu_backend", label="NPU (Hexagon) backend", status="fail", detail=NPU_FIX_TEXT, fix_hint=None)


async def check_ld_library_path(serial: str | None) -> CheckResult:
    return CheckResult(
        id="ld_library_path", label="LD_LIBRARY_PATH sanity (NPU-adjacent)", status="warn",
        detail=LD_LIBRARY_PATH_FIX_TEXT,
    )


async def run_all(serial: str | None = None) -> AsyncIterator[CheckResult]:
    """Runs checks in dependency order, yielding each result as it completes
    so the caller can stream them (e.g. over WebSocket) incrementally."""
    result = await check_adb_binary(serial)
    yield result
    if result.status != "pass":
        return

    device_result, resolved_serial = await check_device_connected(serial)
    yield device_result
    if device_result.status != "pass":
        yield await check_adb_server_responsive(serial)
        return
    serial = resolved_serial

    yield await check_adb_server_responsive(serial)

    termux_result = await check_termux_installed(serial)
    yield termux_result
    if termux_result.status != "pass":
        return

    external_apps_result = await check_termux_external_apps(serial)
    yield external_apps_result
    if external_apps_result.status != "pass":
        return

    yield await check_storage_permission(serial)
    yield await check_required_packages(serial)
    yield await check_llama_cpp_built(serial)
    yield await check_build_flags(serial)
    yield await check_gguf_present(serial)
    yield await check_disk_space(serial)
    yield await check_npu_backend(serial)
    yield await check_ld_library_path(serial)
