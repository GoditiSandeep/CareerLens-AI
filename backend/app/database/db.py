"""SQLAlchemy engine/session setup.

Works with SQLite out of the box and PostgreSQL when DATABASE_URL is set.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _make_engine():
    url = settings.resolved_database_url
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        # Required for SQLite multithreading
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **kwargs)


engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all tables and apply safe, additive schema upgrades.

    Imports models so they register on Base.metadata, creates missing tables,
    then adds any columns introduced after a table was first created
    (e.g. users.role on a pre-existing SQLite database). Only additive
    `ALTER TABLE ... ADD COLUMN` statements are issued — never destructive ones.
    """
    import app.models  # noqa: F401  (registers models)

    Base.metadata.create_all(bind=engine)
    _ensure_added_columns()


# Additive migrations: (table, column, column DDL, backfill SQL or None).
_ADDED_COLUMNS: list[tuple[str, str, str, str | None]] = [
    ("users", "role", "VARCHAR(20) DEFAULT 'student'",
     "UPDATE users SET role = 'student' WHERE role IS NULL"),
    ("jobs", "is_sample", "BOOLEAN DEFAULT FALSE",
     "UPDATE jobs SET is_sample = FALSE WHERE is_sample IS NULL"),
]


def _ensure_added_columns() -> None:
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, column, ddl, backfill in _ADDED_COLUMNS:
            if table not in tables:
                continue  # create_all handles brand-new tables with the column
            existing = {c["name"] for c in inspector.get_columns(table)}
            if column in existing:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            if backfill:
                conn.execute(text(backfill))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
