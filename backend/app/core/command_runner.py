import asyncio
import platform
import subprocess
import time
import uuid
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from app.core.process_registry import process_registry
from app.services.log_service import log_service

LineCallback = Callable[[str, bool], Awaitable[None]]  # (line, is_stderr) -> None


@dataclass
class CommandResult:
    exit_code: int | None
    stdout_lines: list[str]
    stderr_lines: list[str]
    duration_ms: float
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        return self.exit_code == 0 and not self.timed_out


def _popen_kwargs() -> dict:
    if platform.system() == "Windows":
        return {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    return {}


async def _read_stream(stream: asyncio.StreamReader, on_line: LineCallback, is_stderr: bool) -> list[str]:
    lines: list[str] = []
    while True:
        raw = await stream.readline()
        if not raw:
            break
        text = raw.decode(errors="replace").rstrip("\r\n")
        lines.append(text)
        await on_line(text, is_stderr)
    return lines


class CommandRunner:
    """
    Executes commands via argv lists only -- never shell=True, never string
    concatenation. This is the sole place subprocesses are spawned, so every
    caller (adb, Termux, llama.cpp) inherits the same injection-safe behavior.
    """

    async def run(
        self,
        argv: list[str],
        timeout: float | None = None,
        cwd: str | None = None,
        category: str = "System",
        job_id: str | None = None,
    ) -> CommandResult:
        start = time.monotonic()
        job_id = job_id or str(uuid.uuid4())

        async def on_line(line: str, is_stderr: bool) -> None:
            await log_service.emit(category, "WARNING" if is_stderr else "INFO", line, job_id=job_id)

        await log_service.emit(category, "INFO", f"$ {' '.join(argv)}", job_id=job_id)

        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            **_popen_kwargs(),
        )
        process_registry.register(job_id, proc)

        timed_out = False
        try:
            stdout_task = asyncio.create_task(_read_stream(proc.stdout, on_line, False))
            stderr_task = asyncio.create_task(_read_stream(proc.stderr, on_line, True))
            await asyncio.wait_for(proc.wait(), timeout=timeout)
            stdout_lines, stderr_lines = await asyncio.gather(stdout_task, stderr_task)
        except asyncio.TimeoutError:
            timed_out = True
            await process_registry.stop(job_id)
            try:
                await asyncio.wait_for(proc.wait(), timeout=2)
            except asyncio.TimeoutError:
                pass
            try:
                stdout_lines, stderr_lines = await asyncio.wait_for(
                    asyncio.gather(stdout_task, stderr_task), timeout=2
                )
            except asyncio.TimeoutError:
                stdout_task.cancel()
                stderr_task.cancel()
                stdout_lines, stderr_lines = [], []
            await log_service.emit(category, "ERROR", f"command timed out after {timeout}s", job_id=job_id)
        finally:
            process_registry.discard(job_id)

        duration_ms = (time.monotonic() - start) * 1000
        exit_code = proc.returncode
        await log_service.emit(
            category,
            "INFO" if exit_code == 0 else "ERROR",
            f"exit code {exit_code} ({duration_ms:.0f}ms)",
            job_id=job_id,
        )
        return CommandResult(
            exit_code=exit_code,
            stdout_lines=stdout_lines,
            stderr_lines=stderr_lines,
            duration_ms=duration_ms,
            timed_out=timed_out,
        )

    async def run_streaming(
        self,
        argv: list[str],
        job_id: str,
        category: str = "System",
        cwd: str | None = None,
    ) -> asyncio.subprocess.Process:
        """Launch a long-running command; caller reads via log_service/broadcaster
        subscriptions on `job_id` and stops it via process_registry.stop(job_id)."""

        async def on_line(line: str, is_stderr: bool) -> None:
            await log_service.emit(category, "WARNING" if is_stderr else "INFO", line, job_id=job_id)

        await log_service.emit(category, "INFO", f"$ {' '.join(argv)}", job_id=job_id)

        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            **_popen_kwargs(),
        )
        process_registry.register(job_id, proc)

        async def pump() -> None:
            await asyncio.gather(
                _read_stream(proc.stdout, on_line, False),
                _read_stream(proc.stderr, on_line, True),
            )
            exit_code = proc.returncode
            await log_service.emit(
                category,
                "INFO" if exit_code == 0 else "ERROR",
                f"process exited with code {exit_code}",
                job_id=job_id,
            )
            process_registry.discard(job_id)

        asyncio.create_task(pump())
        return proc


command_runner = CommandRunner()
