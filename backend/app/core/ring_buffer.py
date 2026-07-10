import asyncio
from collections import deque
from dataclasses import dataclass, field
from typing import Any


@dataclass
class LogLine:
    channel: str
    category: str
    level: str
    message: str
    timestamp: float
    job_id: str | None = None


class Broadcaster:
    """Bounded ring buffer per channel + fanout to connected WebSocket subscribers."""

    def __init__(self, maxlen: int = 5000) -> None:
        self._buffers: dict[str, deque[LogLine]] = {}
        self._subscribers: dict[str, set[asyncio.Queue]] = {}
        self._maxlen = maxlen
        self._lock = asyncio.Lock()

    def _buffer(self, channel: str) -> deque[LogLine]:
        if channel not in self._buffers:
            self._buffers[channel] = deque(maxlen=self._maxlen)
        return self._buffers[channel]

    def history(self, channel: str) -> list[LogLine]:
        return list(self._buffer(channel))

    async def publish(self, channel: str, line: LogLine) -> None:
        self._buffer(channel).append(line)
        for queue in self._subscribers.get(channel, ()):
            queue.put_nowait(line)

    async def subscribe(self, channel: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._subscribers.setdefault(channel, set()).add(queue)
        return queue

    async def unsubscribe(self, channel: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            subs = self._subscribers.get(channel)
            if subs and queue in subs:
                subs.discard(queue)


broadcaster = Broadcaster()
