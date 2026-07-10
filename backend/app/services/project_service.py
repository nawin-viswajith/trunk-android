import time

from sqlmodel import Session, select

from app.db_models.project import HistoryEntry, Project, PromptTemplate
from app.models.project import ProjectCreate, ProjectUpdate, PromptTemplateCreate


def list_projects(session: Session) -> list[Project]:
    return list(session.exec(select(Project)).all())


def get_project(session: Session, project_id: str) -> Project | None:
    return session.get(Project, project_id)


def create_project(session: Session, data: ProjectCreate) -> Project:
    project = Project(**data.model_dump())
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def update_project(session: Session, project: Project, data: ProjectUpdate) -> Project:
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(project, key, value)
    project.updated_at = time.time()
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def delete_project(session: Session, project: Project) -> None:
    session.delete(project)
    session.commit()


def add_prompt_template(session: Session, project: Project, data: PromptTemplateCreate) -> PromptTemplate:
    template = PromptTemplate(project_id=project.id, **data.model_dump())
    session.add(template)
    session.commit()
    session.refresh(template)
    return template


def list_history(session: Session, project_id: str, limit: int = 100) -> list[HistoryEntry]:
    statement = (
        select(HistoryEntry)
        .where(HistoryEntry.project_id == project_id)
        .order_by(HistoryEntry.timestamp.desc())
        .limit(limit)
    )
    return list(session.exec(statement).all())


def add_history_entry(
    session: Session,
    project_id: str,
    prompt: str,
    response: str,
    tokens_generated: int,
    tokens_per_sec: float,
) -> HistoryEntry:
    entry = HistoryEntry(
        project_id=project_id,
        prompt=prompt,
        response=response,
        tokens_generated=tokens_generated,
        tokens_per_sec=tokens_per_sec,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry
