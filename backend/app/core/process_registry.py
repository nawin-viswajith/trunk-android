import asyncio
import platform
import subprocess


class ProcessRegistry:
    """Tracks running subprocesses by job_id so they can be cancelled/killed."""

    def __init__(self) -> None:
        self._processes: dict[str, asyncio.subprocess.Process] = {}

    def register(self, job_id: str, process: asyncio.subprocess.Process) -> None:
        self._processes[job_id] = process

    def get(self, job_id: str) -> asyncio.subprocess.Process | None:
        return self._processes.get(job_id)

    def discard(self, job_id: str) -> None:
        self._processes.pop(job_id, None)

    def is_running(self, job_id: str) -> bool:
        proc = self._processes.get(job_id)
        return proc is not None and proc.returncode is None

    async def stop(self, job_id: str, grace_period: float = 3.0) -> bool:
        proc = self._processes.get(job_id)
        if proc is None or proc.returncode is not None:
            self.discard(job_id)
            return False

        if platform.system() == "Windows":
            subprocess.run(
                ["taskkill", "/T", "/F", "/PID", str(proc.pid)],
                capture_output=True,
            )
        else:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=grace_period)
            except asyncio.TimeoutError:
                proc.kill()

        self.discard(job_id)
        return True


process_registry = ProcessRegistry()
