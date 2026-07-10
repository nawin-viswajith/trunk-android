import json

from sqlmodel import Session, select

from app.db_models.wizard import WizardState
from app.models.diagnostics import CheckResult
from app.services import diagnostics_service, termux_service
from app.services.adb_service import adb_service

BUILD_CMD = (
    "if [ ! -d ~/llama.cpp ]; then git clone https://github.com/ggml-org/llama.cpp ~/llama.cpp; "
    "else (cd ~/llama.cpp && git pull); fi && "
    "cd ~/llama.cpp && rm -rf build && "
    "cmake -B build -DGGML_NATIVE=OFF -DGGML_CPU_ALL_VARIANTS=OFF && "
    "cmake --build build -j4 && "
    "echo 'GGML_NATIVE=OFF;GGML_CPU_ALL_VARIANTS=OFF' > build/.pocketcoder_build_flags"
)

STEPS = [
    {"id": 1, "title": "Install Termux"},
    {"id": 2, "title": "Install Dependencies"},
    {"id": 3, "title": "Deploy llama.cpp"},
    {"id": 4, "title": "Configure Environment"},
    {"id": 5, "title": "Run Diagnostics"},
]


def get_state(session: Session, serial: str) -> WizardState:
    state = session.get(WizardState, serial)
    if state is None:
        state = WizardState(serial=serial)
        session.add(state)
        session.commit()
        session.refresh(state)
    return state


def _save_step_status(session: Session, state: WizardState, step_id: int, status: str) -> WizardState:
    statuses = json.loads(state.step_status_json)
    statuses[str(step_id)] = status
    state.step_status_json = json.dumps(statuses)
    state.current_step = max(state.current_step, step_id if status == "pass" else state.current_step)
    session.add(state)
    session.commit()
    session.refresh(state)
    return state


async def run_step(session: Session, serial: str, step_id: int) -> CheckResult:
    state = get_state(session, serial)

    if step_id == 1:
        result = await diagnostics_service.check_termux_installed(serial)
    elif step_id == 2:
        installed = await termux_service.is_termux_installed(serial)
        if not installed:
            result = CheckResult(id="wizard_step_2", label="Install Dependencies", status="fail",
                                  detail="Termux is not installed", fix_hint="Complete Step 1 first.")
        else:
            job_id = await termux_service.run_command(
                "pkg update -y && pkg upgrade -y && termux-setup-storage && "
                "pkg install git cmake clang make python -y",
                serial,
            )
            exit_code, output = await termux_service.wait_for_job(
                job_id, serial, poll_interval=3, timeout=300, emit_progress=True, category="System",
            )
            result = CheckResult(
                id="wizard_step_2", label="Install Dependencies",
                status="pass" if exit_code == 0 else "fail",
                detail=output[-2000:] if output else "package install finished",
                fix_hint=None if exit_code == 0 else "Check Logs for the failing package install command.",
            )
    elif step_id == 3:
        job_id = await termux_service.run_command(BUILD_CMD, serial, category="CPU")
        exit_code, output = await termux_service.wait_for_job(
            job_id, serial, poll_interval=5, timeout=1800, emit_progress=True, category="CPU",
        )
        result = CheckResult(
            id="wizard_step_3", label="Deploy llama.cpp",
            status="pass" if exit_code == 0 else "fail",
            detail=output[-2000:] if output else "build finished",
            fix_hint=None if exit_code == 0 else (
                "Build failed. If you see `clang frontend command failed (exit 139)`, this build "
                "already passes -DGGML_NATIVE=OFF -DGGML_CPU_ALL_VARIANTS=OFF -- check Logs for the "
                "actual clang/cmake error."
            ),
        )
    elif step_id == 4:
        await adb_service.shell(["mkdir", "-p", "/sdcard/Download"], serial=serial)
        result = CheckResult(id="wizard_step_4", label="Configure Environment", status="pass",
                              detail="CPU backend needs no custom environment variables.")
    elif step_id == 5:
        last: CheckResult | None = None
        async for check in diagnostics_service.run_all(serial):
            last = check
        result = CheckResult(
            id="wizard_step_5", label="Run Diagnostics",
            status="pass" if last and last.status in ("pass", "warn") else "fail",
            detail="Diagnostics complete -- see Diagnostics screen for full detail.",
        )
    else:
        raise ValueError(f"unknown wizard step: {step_id}")

    _save_step_status(session, state, step_id, result.status)
    return result


def get_progress(session: Session, serial: str) -> dict:
    state = get_state(session, serial)
    statuses = json.loads(state.step_status_json)
    return {
        "steps": STEPS,
        "current_step": state.current_step,
        "statuses": statuses,
        "ready": statuses.get("5") == "pass",
    }
