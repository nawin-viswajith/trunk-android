from dataclasses import dataclass

from app.config import settings
from app.core.command_runner import CommandResult, command_runner
from app.utils.shell_quote import validate_identifier


@dataclass
class Device:
    serial: str
    state: str  # "device" | "unauthorized" | "offline"


class AdbService:
    def __init__(self, adb_path: str) -> None:
        self._adb_path = adb_path
        self._active_serial: str | None = settings.device_serial or None

    async def version(self) -> CommandResult:
        return await command_runner.run([self._adb_path, "version"], category="System")

    async def list_devices(self) -> list[Device]:
        result = await command_runner.run([self._adb_path, "devices"], category="System")
        devices: list[Device] = []
        for line in result.stdout_lines:
            line = line.strip()
            if not line or line.startswith("List of devices"):
                continue
            parts = line.split("\t")
            if len(parts) == 2:
                devices.append(Device(serial=parts[0], state=parts[1]))
        return devices

    async def restart_server(self) -> CommandResult:
        await command_runner.run([self._adb_path, "kill-server"], category="System")
        return await command_runner.run([self._adb_path, "start-server"], category="System")

    def set_active_serial(self, serial: str) -> None:
        self._active_serial = validate_identifier(serial, field_name="device serial")

    def active_serial(self) -> str | None:
        return self._active_serial

    def _require_serial(self, serial: str | None) -> str:
        serial = serial or self._active_serial
        if not serial:
            raise ValueError("no active device selected")
        return validate_identifier(serial, field_name="device serial")

    async def shell(
        self,
        args: list[str],
        serial: str | None = None,
        timeout: float | None = 30,
        category: str = "System",
    ) -> CommandResult:
        """Runs `adb -s <serial> shell <args...>` -- args are passed as separate
        argv elements, not a single shell string, whenever possible."""
        serial = self._require_serial(serial)
        return await command_runner.run(
            [self._adb_path, "-s", serial, "shell", *args],
            timeout=timeout,
            category=category,
        )

    async def push(self, local_path: str, remote_path: str, serial: str | None = None) -> CommandResult:
        serial = self._require_serial(serial)
        return await command_runner.run(
            [self._adb_path, "-s", serial, "push", local_path, remote_path],
            category="System",
        )

    async def pull(self, remote_path: str, local_path: str, serial: str | None = None) -> CommandResult:
        serial = self._require_serial(serial)
        return await command_runner.run(
            [self._adb_path, "-s", serial, "pull", remote_path, local_path],
            category="System",
        )

    async def forward(self, local_port: int, remote_port: int, serial: str | None = None) -> CommandResult:
        serial = self._require_serial(serial)
        return await command_runner.run(
            [self._adb_path, "-s", serial, "forward", f"tcp:{local_port}", f"tcp:{remote_port}"],
            category="System",
        )

    async def forward_list(self, serial: str | None = None) -> CommandResult:
        serial = self._require_serial(serial)
        return await command_runner.run([self._adb_path, "-s", serial, "forward", "--list"], category="System")

    async def forward_remove(self, local_port: int, serial: str | None = None) -> CommandResult:
        serial = self._require_serial(serial)
        return await command_runner.run(
            [self._adb_path, "-s", serial, "forward", "--remove", f"tcp:{local_port}"],
            category="System",
        )


adb_service = AdbService(settings.adb_path)
