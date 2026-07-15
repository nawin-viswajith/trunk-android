import re

QUANT_PATTERN = re.compile(r"(Q\d(?:_[A-Z0-9]+)?|F16|F32|BF16)", re.IGNORECASE)
PARAM_PATTERN = re.compile(r"\b(\d+(?:\.\d+)?)B\b", re.IGNORECASE)


def quant_from_filename(filename: str) -> str | None:
    match = QUANT_PATTERN.search(filename)
    return match.group(1).upper() if match else None


def params_from_repo_id(repo_id: str) -> str | None:
    """HF has no structured param-count field for GGUF-only repos, so this
    parses the naming convention repo authors use (e.g. `Llama-3.1-8B-...`)."""
    match = PARAM_PATTERN.search(repo_id)
    return f"{match.group(1)}B" if match else None
