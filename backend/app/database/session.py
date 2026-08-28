from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def sqlite_connect_args(database_url: str) -> dict[str, bool]:
    """SQLite requires this to share one connection across FastAPI's
    per-request threads; every other dialect's driver rejects it."""
    return {"check_same_thread": False} if database_url.startswith("sqlite") else {}


_database_url = get_settings().database_url
engine = create_engine(_database_url, connect_args=sqlite_connect_args(_database_url))

if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
