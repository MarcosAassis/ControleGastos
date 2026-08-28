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


def _table_columns(conn, table: str) -> set[str]:
    if IS_SQLITE:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        return {row[1] for row in rows}
    rows = conn.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = :table
            """
        ),
        {"table": table},
    ).fetchall()
    return {row[0] for row in rows}


def _add_user_id(conn, table: str):
    columns = _table_columns(conn, table)
    if not columns or "user_id" in columns:
        return
    if IS_SQLITE:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER"))
    else:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id INTEGER"))


def migrate_schema():
    with engine.begin() as conn:
        if IS_SQLITE:
            columns = _table_columns(conn, "fixed_expenses")
            if columns and "due_date" not in columns:
                conn.execute(text("ALTER TABLE fixed_expenses ADD COLUMN due_date DATE"))
            if columns and "due_day" in columns:
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
                        {
                            "due_date": date(today.year, today.month, day).isoformat(),
                            "id": expense_id,
                        },
                    )
            routine_names = _table_columns(conn, "work_routines")
            if routine_names and "weekdays" not in routine_names:
                conn.execute(
                    text(
                        "ALTER TABLE work_routines ADD COLUMN weekdays VARCHAR(40) DEFAULT '[0,1,2,3,4]'"
                    )
                )
                conn.execute(
                    text(
                        "UPDATE work_routines SET weekdays = '[0,1,2,3,4]' WHERE weekdays IS NULL"
                    )
                )

        for table in (
            "work_routines",
            "work_day_overrides",
            "goal_settings",
            "monthly_goals",
            "fixed_expenses",
            "variable_expenses",
            "daily_earnings",
        ):
            _add_user_id(conn, table)

        if not IS_SQLITE:
            conn.execute(
                text("ALTER TABLE daily_earnings DROP CONSTRAINT IF EXISTS daily_earnings_date_key")
            )
            conn.execute(
                text(
                    "ALTER TABLE work_day_overrides DROP CONSTRAINT IF EXISTS work_day_overrides_date_key"
                )
            )

        conn.execute(text("DROP TABLE IF EXISTS uber_oauth_states"))
        conn.execute(text("DROP TABLE IF EXISTS uber_connections"))
