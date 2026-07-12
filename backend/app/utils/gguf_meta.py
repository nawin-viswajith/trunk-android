import re

QUANT_PATTERN = re.compile(r"(Q\d(?:_[A-Z0-9]+)?|F16|F32|BF16)", re.IGNORECASE)


def quant_from_filename(filename: str) -> str | None:
    match = QUANT_PATTERN.search(filename)
    return match.group(1).upper() if match else None
