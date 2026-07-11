from app.models.project import ProjectCreate, ProjectUpdate, PromptTemplateCreate
from app.services import project_service


def test_create_and_get_project(session):
    created = project_service.create_project(session, ProjectCreate(name="AI Assistant"))
    fetched = project_service.get_project(session, created.id)

    assert fetched is not None
    assert fetched.name == "AI Assistant"
    assert fetched.backend == "cpu"


def test_get_project_missing_returns_none(session):
    assert project_service.get_project(session, "does-not-exist") is None


def test_list_projects(session):
    project_service.create_project(session, ProjectCreate(name="A"))
    project_service.create_project(session, ProjectCreate(name="B"))

    projects = project_service.list_projects(session)
    assert {p.name for p in projects} == {"A", "B"}


def test_update_project_only_touches_provided_fields(session):
    project = project_service.create_project(session, ProjectCreate(name="A", temperature=0.7))

    updated = project_service.update_project(session, project, ProjectUpdate(temperature=0.2))

    assert updated.temperature == 0.2
    assert updated.name == "A"  # untouched
    assert updated.updated_at >= updated.created_at


def test_delete_project(session):
    project = project_service.create_project(session, ProjectCreate(name="A"))
    project_service.delete_project(session, project)
    assert project_service.get_project(session, project.id) is None


def test_add_prompt_template(session):
    project = project_service.create_project(session, ProjectCreate(name="A"))
    template = project_service.add_prompt_template(
        session, project, PromptTemplateCreate(name="Refactor", template_text="Refactor this: {code}")
    )
    assert template.project_id == project.id
    assert template.name == "Refactor"


def test_history_add_and_list_ordering(session):
    project = project_service.create_project(session, ProjectCreate(name="A"))
    project_service.add_history_entry(session, project.id, "prompt 1", "response 1", 10, 5.0)
    project_service.add_history_entry(session, project.id, "prompt 2", "response 2", 20, 8.0)

    history = project_service.list_history(session, project.id)

    assert len(history) == 2
    # most recent first
    assert history[0].prompt == "prompt 2"
    assert history[1].prompt == "prompt 1"


def test_history_scoped_to_project(session):
    project_a = project_service.create_project(session, ProjectCreate(name="A"))
    project_b = project_service.create_project(session, ProjectCreate(name="B"))
    project_service.add_history_entry(session, project_a.id, "a-prompt", "a-response", 1, 1.0)
    project_service.add_history_entry(session, project_b.id, "b-prompt", "b-response", 1, 1.0)

    history_a = project_service.list_history(session, project_a.id)

    assert len(history_a) == 1
    assert history_a[0].prompt == "a-prompt"
