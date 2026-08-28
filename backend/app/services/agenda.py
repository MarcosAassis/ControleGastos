import json
from calendar import monthrange
from datetime import date

from sqlalchemy.orm import Session

from ..models import WorkDayOverride

DEFAULT_WEEKDAYS = [0, 1, 2, 3, 4]


def parse_weekdays(raw) -> list[int]:
    if isinstance(raw, list):
        values = raw
    else:
        try:
            values = json.loads(raw or "[]")
        except json.JSONDecodeError:
            values = DEFAULT_WEEKDAYS
    return sorted({int(day) for day in values if 0 <= int(day) <= 6})


def dump_weekdays(weekdays: list[int]) -> str:
    return json.dumps(parse_weekdays(weekdays))


def dates_in_month(year: int, month: int) -> list[date]:
    last = monthrange(year, month)[1]
    return [date(year, month, day) for day in range(1, last + 1)]


def load_overrides(db: Session, user_id: int, start: date, end: date) -> dict[date, bool]:
    rows = (
        db.query(WorkDayOverride)
        .filter(
            WorkDayOverride.user_id == user_id,
            WorkDayOverride.date >= start,
            WorkDayOverride.date <= end,
        )
        .all()
    )
    return {row.date: row.working for row in rows}


def is_working_day(day: date, weekdays: list[int], overrides: dict[date, bool]) -> bool:
    if day in overrides:
        return overrides[day]
    return day.weekday() in weekdays


def working_dates(
    year: int, month: int, weekdays: list[int], overrides: dict[date, bool]
) -> list[date]:
    return [
        day
        for day in dates_in_month(year, month)
        if is_working_day(day, weekdays, overrides)
    ]
