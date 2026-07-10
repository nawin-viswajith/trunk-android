from typing import Annotated

from fastapi import Depends, Header
from sqlmodel import Session

from app.db import get_session

SessionDep = Annotated[Session, Depends(get_session)]


def get_serial(x_device_serial: Annotated[str | None, Header()] = None) -> str | None:
    return x_device_serial


SerialDep = Annotated[str | None, Depends(get_serial)]
