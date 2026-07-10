from fastapi import APIRouter, HTTPException

from app.db_models.project import HistoryEntry, Project
from app.deps import SessionDep
from app.models.project import ProjectCreate, ProjectUpdate, PromptTemplateCreate
from app.services import project_service

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[Project])
def list_projects(session: SessionDep) -> list[Project]:
    return project_service.list_projects(session)


@router.post("", response_model=Project)
def create_project(data: ProjectCreate, session: SessionDep) -> Project:
    return project_service.create_project(session, data)


def _get_or_404(session: SessionDep, project_id: str) -> Project:
    project = project_service.get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="project not found")
    return project


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str, session: SessionDep) -> Project:
    return _get_or_404(session, project_id)


@router.patch("/{project_id}", response_model=Project)
def update_project(project_id: str, data: ProjectUpdate, session: SessionDep) -> Project:
    project = _get_or_404(session, project_id)
    return project_service.update_project(session, project, data)


@router.delete("/{project_id}")
def delete_project(project_id: str, session: SessionDep) -> dict:
    project = _get_or_404(session, project_id)
    project_service.delete_project(session, project)
    return {"status": "deleted"}


@router.post("/{project_id}/templates")
def add_template(project_id: str, data: PromptTemplateCreate, session: SessionDep):
    project = _get_or_404(session, project_id)
    return project_service.add_prompt_template(session, project, data)


@router.get("/{project_id}/history", response_model=list[HistoryEntry])
def get_history(project_id: str, session: SessionDep, limit: int = 100) -> list[HistoryEntry]:
    _get_or_404(session, project_id)
    return project_service.list_history(session, project_id, limit)
