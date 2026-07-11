import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

import app.db_models.project  # noqa: F401  (register models before create_all)
import app.db_models.wizard  # noqa: F401


@pytest.fixture()
def session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
