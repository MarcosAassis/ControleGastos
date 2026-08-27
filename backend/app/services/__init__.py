from ..database import SessionLocal
from ..models import GoalSettings, WorkRoutine


def get_or_create_routine(db):
    routine = db.query(WorkRoutine).first()
    if not routine:
        routine = WorkRoutine(
            days_per_month=22,
            days_per_week=5,
            hours_per_day=8.0,
            weekdays="[0,1,2,3,4]",
        )
        db.add(routine)
        db.commit()
        db.refresh(routine)
    return routine


def get_or_create_goals(db):
    settings = db.query(GoalSettings).first()
    if not settings:
        settings = GoalSettings(monthly_net_profit=0.0, monthly_contingency=0.0)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def ensure_defaults():
    db = SessionLocal()
    try:
        get_or_create_routine(db)
        get_or_create_goals(db)
    finally:
        db.close()
