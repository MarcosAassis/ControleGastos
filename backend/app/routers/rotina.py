from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User, WorkDayOverride
from ..schemas import WorkDayToggleIn, WorkRoutineIn, WorkRoutineOut
from ..services import get_or_create_routine
from ..services.agenda import (
    dump_weekdays,
    is_working_day,
    load_overrides,
    parse_weekdays,
    working_dates,
)
from ..services.calculos import month_range

router = APIRouter()


def _periodo(ano: int | None, mes: int | None) -> tuple[int, int]:
    today = date.today()
    return ano or today.year, mes or today.month


def serialize_routine(db: Session, user_id: int, year: int, month: int) -> dict:
    routine = get_or_create_routine(db, user_id)
    weekdays = parse_weekdays(getattr(routine, "weekdays", None))
    start, end = month_range(year, month)
    overrides = load_overrides(db, user_id, start, end)
    dates = working_dates(year, month, weekdays, overrides)
    return {
        "id": routine.id,
        "weekdays": weekdays,
        "hours_per_day": routine.hours_per_day,
        "days_per_week": len(weekdays),
        "days_per_month": len(dates),
        "working_dates": dates,
        "overrides": {day.isoformat(): value for day, value in overrides.items()},
        "updated_at": routine.updated_at,
    }


@router.get("", response_model=WorkRoutineOut)
def get_rotina(
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    year, month = _periodo(ano, mes)
    return serialize_routine(db, user.id, year, month)


@router.put("", response_model=WorkRoutineOut)
def update_rotina(
    payload: WorkRoutineIn,
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    year, month = _periodo(ano, mes)
    routine = get_or_create_routine(db, user.id)
    routine.weekdays = dump_weekdays(payload.weekdays)
    routine.hours_per_day = payload.hours_per_day
    routine.updated_at = datetime.utcnow()
    weekdays = parse_weekdays(payload.weekdays)
    start, end = month_range(year, month)
    for row in (
        db.query(WorkDayOverride)
        .filter(
            WorkDayOverride.user_id == user.id,
            WorkDayOverride.date >= start,
            WorkDayOverride.date <= end,
        )
        .all()
    ):
        if row.working == (row.date.weekday() in weekdays):
            db.delete(row)
    db.commit()
    return serialize_routine(db, user.id, year, month)


@router.patch("/dia", response_model=WorkRoutineOut)
def toggle_dia(
    payload: WorkDayToggleIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    routine = get_or_create_routine(db, user.id)
    weekdays = parse_weekdays(getattr(routine, "weekdays", None))
    override = (
        db.query(WorkDayOverride)
        .filter(WorkDayOverride.user_id == user.id, WorkDayOverride.date == payload.date)
        .first()
    )
    current = is_working_day(
        payload.date,
        weekdays,
        {override.date: override.working} if override else {},
    )
    pattern = payload.date.weekday() in weekdays
    new_value = not current

    if new_value == pattern:
        if override:
            db.delete(override)
    elif override:
        override.working = new_value
    else:
        db.add(WorkDayOverride(user_id=user.id, date=payload.date, working=new_value))

    routine.updated_at = datetime.utcnow()
    db.commit()
    return serialize_routine(db, user.id, payload.date.year, payload.date.month)
