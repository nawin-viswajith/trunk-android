from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

engine = create_engine(f"sqlite:///{settings.db_path}", connect_args={"check_same_thread": False})


def init_db() -> None:
    import app.db_models.project  # noqa: F401  (register models before create_all)
    import app.db_models.wizard  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
