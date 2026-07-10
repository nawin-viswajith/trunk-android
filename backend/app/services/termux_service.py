"""
Runs commands *inside* Termux's own environment (its private app sandbox,
which plain `adb shell` cannot read/write directly on a non-rooted device)
via the Termux:API RUN_COMMAND intent.

This requires a one-time manual step on the phone: `allow-external-apps = true`
in `~/.termux/termux.properties`, then restarting Termux. Diagnostics check
`termux_external_apps` surfaces this if it isn't set.

RUN_COMMAND is fire-and-forget over Android's intent system -- there is no
direct stdout pipe back to adb. So every command run this way is wrapped to
redirect its output + exit code into a file under Termux's shared-storage
bridge (`~/storage/downloads`, i.e. `/sdcard/Download` -- readable via plain
`adb shell`/`adb pull` since it's regular shared storage, unlike the app's
private data dir). Callers poll for the completion marker and then pull the
captured output.
"""

import asyncio
import uuid

from app.config import settings
from app.core.command_runner import command_runner
from app.services.adb_service import adb_service
from app.services.log_service import log_service
from app.utils.shell_quote import build_remote_command

TERMUX_PACKAGE = "com.termux"
TERMUX_BASH = "/data/data/com.termux/files/usr/bin/bash"
TERMUX_HOME = "/data/data/com.termux/files/home"
JOB_DIR = f"{settings.remote_download_dir}/.pocketcoder"


async def is_termux_installed(serial: str | None = None) -> bool:
    result = await adb_service.shell(["pm", "list", "packages", TERMUX_PACKAGE], serial=serial, category="System")
    return any(TERMUX_PACKAGE in line for line in result.stdout_lines)


async def ensure_job_dir(serial: str | None = None) -> None:
    await adb_service.shell(["mkdir", "-p", JOB_DIR], serial=serial, category="System")


async def run_command(command: str, serial: str | None = None, category: str = "System") -> str:
    """Fires `command` inside Termux's shell via RUN_COMMAND. Returns a job_id;
    poll `job_status(job_id)` for completion."""
    await ensure_job_dir(serial)
    job_id = str(uuid.uuid4())
    out_path = f"{JOB_DIR}/{job_id}.out"
    done_path = f"{JOB_DIR}/{job_id}.done"

    wrapped = build_remote_command("bash", "-lc", f"({command}) > {out_path} 2>&1; echo $? > {done_path}")

    intent_args = [
        "am", "start-foreground-service",
        "--user", "0",
        "-n", f"{TERMUX_PACKAGE}/.app.RunCommandService",
        "-a", f"{TERMUX_PACKAGE}.RUN_COMMAND",
        "--es", f"{TERMUX_PACKAGE}.RUN_COMMAND_PATH", TERMUX_BASH,
        "--esa", f"{TERMUX_PACKAGE}.RUN_COMMAND_ARGUMENTS", f"-c,{wrapped}",
        "--es", f"{TERMUX_PACKAGE}.RUN_COMMAND_WORKDIR", TERMUX_HOME,
        "--ez", f"{TERMUX_PACKAGE}.RUN_COMMAND_BACKGROUND", "true",
    ]
    await adb_service.shell(intent_args, serial=serial, category=category)
    return job_id


async def job_status(job_id: str, serial: str | None = None) -> tuple[bool, int | None, str]:
    """Returns (done, exit_code, output_text). Polls the marker file, pulls
    output on completion."""
    done_path = f"{JOB_DIR}/{job_id}.done"
    out_path = f"{JOB_DIR}/{job_id}.out"

    check = await adb_service.shell(["test", "-f", done_path, "&&", "cat", done_path], serial=serial)
    if check.exit_code != 0 or not check.stdout_lines:
        return False, None, ""

    exit_code = int(check.stdout_lines[0].strip() or -1)
    output = await adb_service.shell(["cat", out_path], serial=serial)
    return True, exit_code, "\n".join(output.stdout_lines)


async def _tail_new_output(job_id: str, serial: str | None, last_len: int, category: str) -> int:
    """Cats the (possibly still-growing) output file and emits any lines past
    `last_len` chars to log_service, so long-running builds show live progress
    in the Log Viewer instead of going silent until they finish."""
    out_path = f"{JOB_DIR}/{job_id}.out"
    result = await adb_service.shell(["cat", out_path], serial=serial)
    text = "\n".join(result.stdout_lines)
    if len(text) > last_len:
        new_text = text[last_len:]
        for line in new_text.splitlines():
            if line.strip():
                await log_service.emit(category, "INFO", line, job_id=job_id)
    return len(text)


async def wait_for_job(
    job_id: str,
    serial: str | None = None,
    poll_interval: float = 2.0,
    timeout: float = 600.0,
    emit_progress: bool = False,
    category: str = "System",
) -> tuple[int | None, str]:
    elapsed = 0.0
    last_len = 0
    while elapsed < timeout:
        if emit_progress:
            last_len = await _tail_new_output(job_id, serial, last_len, category)
        done, exit_code, output = await job_status(job_id, serial)
        if done:
            if emit_progress:
                await _tail_new_output(job_id, serial, last_len, category)
            return exit_code, output
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval
    return None, "timed out waiting for Termux job to complete"
