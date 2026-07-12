"""Minimal pure-Python GGUF header reader -- just enough metadata for the
Model Manager card (architecture, context length, param hints), without
depending on llama.cpp's Python bindings."""

import re
import struct
from dataclasses import dataclass
from pathlib import Path

GGUF_MAGIC = b"GGUF"

_VALUE_TYPE_READERS = {
    0: ("B", 1),   # UINT8
    1: ("b", 1),   # INT8
    2: ("H", 2),   # UINT16
    3: ("h", 2),   # INT16
    4: ("I", 4),   # UINT32
    5: ("i", 4),   # INT32
    6: ("f", 4),   # FLOAT32
    7: ("?", 1),   # BOOL
    10: ("Q", 8),  # UINT64
    11: ("q", 8),  # INT64
    12: ("d", 8),  # FLOAT64
}
STRING_TYPE = 8
ARRAY_TYPE = 9

QUANT_PATTERN = re.compile(r"(Q\d(?:_[A-Z0-9]+)?|F16|F32|BF16)", re.IGNORECASE)


@dataclass
class GgufInfo:
    architecture: str | None
    name: str | None
    context_length: int | None
    quant_from_filename: str | None
    size_bytes: int


def _read_string(f) -> str:
    (length,) = struct.unpack("<Q", f.read(8))
    return f.read(length).decode("utf-8", errors="replace")


def _read_value(f, value_type: int):
    if value_type == STRING_TYPE:
        return _read_string(f)
    if value_type == ARRAY_TYPE:
        (elem_type,) = struct.unpack("<I", f.read(4))
        (count,) = struct.unpack("<Q", f.read(8))
        return [_read_value(f, elem_type) for _ in range(count)]
    fmt, size = _VALUE_TYPE_READERS[value_type]
    (value,) = struct.unpack(f"<{fmt}", f.read(size))
    return value


def quant_from_filename(filename: str) -> str | None:
    match = QUANT_PATTERN.search(filename)
    return match.group(1).upper() if match else None


def read_gguf_info(path: Path, max_kv_pairs: int = 64) -> GgufInfo:
    size_bytes = path.stat().st_size
    architecture = None
    name = None
    context_length = None

    try:
        with path.open("rb") as f:
            magic = f.read(4)
            if magic != GGUF_MAGIC:
                raise ValueError("not a GGUF file")
            (version,) = struct.unpack("<I", f.read(4))
            if version >= 2:
                (tensor_count,) = struct.unpack("<Q", f.read(8))
                (kv_count,) = struct.unpack("<Q", f.read(8))
            else:
                (tensor_count,) = struct.unpack("<I", f.read(4))
                (kv_count,) = struct.unpack("<I", f.read(4))

            for _ in range(min(kv_count, max_kv_pairs)):
                key = _read_string(f)
                (value_type,) = struct.unpack("<I", f.read(4))
                value = _read_value(f, value_type)
                if key == "general.architecture":
                    architecture = value
                elif key == "general.name":
                    name = value
                elif key.endswith(".context_length"):
                    context_length = value
    except (ValueError, struct.error, UnicodeDecodeError):
        pass  # fall back to filename-derived metadata only

    return GgufInfo(
        architecture=architecture,
        name=name,
        context_length=context_length,
        quant_from_filename=quant_from_filename(path.name),
        size_bytes=size_bytes,
    )
