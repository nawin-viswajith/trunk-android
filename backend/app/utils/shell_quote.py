import shlex


def build_remote_command(*parts: str) -> str:
    """Join argv-style parts into a single POSIX shell command string, quoting
    every part. Use only when a single shell string is unavoidable (e.g. a
    remote `cd X && Y` pipeline) -- prefer passing separate argv elements to
    `adb shell` wherever the remote command supports it."""
    return " ".join(shlex.quote(p) for p in parts)


def validate_identifier(value: str, *, field_name: str) -> str:
    """Reject anything that isn't a plain alnum/dot/dash/underscore token --
    used for values (serials, filenames) that get embedded into remote shell
    strings, on top of shlex.quote, as defense in depth."""
    if not value or not all(c.isalnum() or c in "._-:" for c in value):
        raise ValueError(f"invalid {field_name}: {value!r}")
    return value
