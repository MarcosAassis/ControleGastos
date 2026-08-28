from ..database import SessionLocal
from ..models import GoalSettings, WorkRoutine


def get_or_create_routine(db, user_id: int):
    routine = db.query(WorkRoutine).filter(WorkRoutine.user_id == user_id).first()
    if not routine:
        routine = WorkRoutine(
            user_id=user_id,
            days_per_month=22,
            days_per_week=5,
            hours_per_day=8.0,
            weekdays="[0,1,2,3,4]",
        )
        db.add(routine)
        db.commit()
        db.refresh(routine)
    return routine


def get_or_create_goals(db, user_id: int):
    settings = db.query(GoalSettings).filter(GoalSettings.user_id == user_id).first()
    if not settings:
        settings = GoalSettings(
            user_id=user_id,
            monthly_net_profit=0.0,
            monthly_contingency=0.0,
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings
