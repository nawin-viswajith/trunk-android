import json
import time
from pathlib import Path

from app.config import settings
from app.core.ring_buffer import Broadcaster, LogLine, broadcaster

GLOBAL_CHANNEL = "global"
VALID_CATEGORIES = {"CPU", "NPU", "DSP", "FastRPC", "OpenCL", "System"}
VALID_LEVELS = {"INFO", "WARNING", "ERROR"}


class LogService:
    def __init__(self, bus: Broadcaster, log_file: Path) -> None:
        self._bus = bus
        self._log_file = log_file

    async def emit(
        self,
        category: str,
        level: str,
        message: str,
        job_id: str | None = None,
    ) -> None:
        assert category in VALID_CATEGORIES, f"unknown log category: {category}"
        assert level in VALID_LEVELS, f"unknown log level: {level}"
        line = LogLine(
            channel=GLOBAL_CHANNEL,
            category=category,
            level=level,
            message=message,
            timestamp=time.time(),
            job_id=job_id,
        )
        await self._bus.publish(GLOBAL_CHANNEL, line)
        if job_id:
            await self._bus.publish(job_id, line)
        self._append_to_file(line)

    def _append_to_file(self, line: LogLine) -> None:
        record = {
            "ts": line.timestamp,
            "category": line.category,
            "level": line.level,
            "message": line.message,
            "job_id": line.job_id,
        }
        with self._log_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

    def history(self, channel: str = GLOBAL_CHANNEL) -> list[LogLine]:
        return self._bus.history(channel)

    def query(
        self,
        category: str | None = None,
        level: str | None = None,
        q: str | None = None,
        since: float | None = None,
        limit: int = 500,
    ) -> list[dict]:
        results: list[dict] = []
        if not self._log_file.exists():
            return results
        with self._log_file.open("r", encoding="utf-8") as f:
            for raw in f:
                raw = raw.strip()
                if not raw:
                    continue
                try:
                    record = json.loads(raw)
                except ValueError:
                    continue
                if category and record.get("category") != category:
                    continue
                if level and record.get("level") != level:
                    continue
                if since and record.get("ts", 0) < since:
                    continue
                if q and q.lower() not in record.get("message", "").lower():
                    continue
                results.append(record)
        return results[-limit:]


log_service = LogService(broadcaster, settings.log_file)
