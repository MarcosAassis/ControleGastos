from calendar import monthrange
from datetime import date

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .settings import DATABASE_URL


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


SQLALCHEMY_DATABASE_URL = normalize_database_url(DATABASE_URL)
IS_SQLITE = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

engine_kwargs = {"pool_pre_ping": True}
if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_schema():
    if not IS_SQLITE:
        return

    with engine.begin() as conn:
        columns = conn.execute(text("PRAGMA table_info(fixed_expenses)")).fetchall()
        names = {row[1] for row in columns}
        if not names:
            return
        if "due_date" not in names:
            conn.execute(text("ALTER TABLE fixed_expenses ADD COLUMN due_date DATE"))
        if "due_day" in names:
            today = date.today()
            rows = conn.execute(
                text("SELECT id, due_day, due_date FROM fixed_expenses")
            ).fetchall()
            last_day = monthrange(today.year, today.month)[1]
            for expense_id, due_day, due_date in rows:
                if due_date or not due_day:
                    continue
                day = min(int(due_day), last_day)
                conn.execute(
                    text("UPDATE fixed_expenses SET due_date = :due_date WHERE id = :id"),
                    {"due_date": date(today.year, today.month, day).isoformat(), "id": expense_id},
                )

        routine_cols = conn.execute(text("PRAGMA table_info(work_routines)")).fetchall()
        routine_names = {row[1] for row in routine_cols}
        if routine_names and "weekdays" not in routine_names:
            conn.execute(
                text(
                    "ALTER TABLE work_routines ADD COLUMN weekdays VARCHAR(40) DEFAULT '[0,1,2,3,4]'"
                )
            )
            conn.execute(
                text("UPDATE work_routines SET weekdays = '[0,1,2,3,4]' WHERE weekdays IS NULL")
            )
