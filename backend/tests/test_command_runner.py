import sys

import pytest

from app.core.command_runner import command_runner


@pytest.mark.asyncio
async def test_run_captures_stdout_and_exit_code():
    result = await command_runner.run([sys.executable, "-c", "print('hello')"])
    assert result.exit_code == 0
    assert result.stdout_lines == ["hello"]
    assert result.ok


@pytest.mark.asyncio
async def test_run_does_not_interpret_shell_metacharacters():
    """A value containing shell metacharacters must be treated as a single
    literal argv element, never parsed by a shell -- this is the whole point
    of never using shell=True."""
    dangerous = "; rm -rf / #"
    result = await command_runner.run([sys.executable, "-c", "import sys; print(sys.argv[1])", dangerous])
    assert result.stdout_lines == [dangerous]
    assert result.exit_code == 0


@pytest.mark.asyncio
async def test_run_reports_nonzero_exit_code():
    result = await command_runner.run([sys.executable, "-c", "import sys; sys.exit(3)"])
    assert result.exit_code == 3
    assert not result.ok


@pytest.mark.asyncio
async def test_run_timeout_is_flagged():
    result = await command_runner.run(
        [sys.executable, "-c", "import time; time.sleep(5)"],
        timeout=0.2,
    )
    assert result.timed_out
    assert not result.ok
