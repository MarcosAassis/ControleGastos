from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import MonthlyGoal, User
from ..schemas import GoalSettingsIn, GoalSettingsOut, MetasOut
from ..services import get_goals_for_month, get_or_create_goals
from ..services.calculos import calcular_metas
from ..services.provisao import campos_provisao

router = APIRouter()


def _goal_out(goals, *, year=None, month=None, is_custom=False) -> GoalSettingsOut:
    include_13th, vacation_days_year, planned_rest_days = campos_provisao(goals)
    return GoalSettingsOut(
        id=getattr(goals, "id", None),
        monthly_net_profit=goals.monthly_net_profit,
        monthly_contingency=goals.monthly_contingency,
        include_13th=include_13th,
        vacation_days_year=vacation_days_year,
        planned_rest_days=planned_rest_days,
        checkpoint_amount=float(getattr(goals, "checkpoint_amount", 0) or 0),
        checkpoint_day=int(getattr(goals, "checkpoint_day", 0) or 0),
        year=year,
        month=month,
        is_custom=is_custom,
        updated_at=getattr(goals, "updated_at", None),
    )


def _apply_goals(target, payload: GoalSettingsIn) -> None:
    include_13th, vacation_days_year, planned_rest_days = campos_provisao(payload)
    target.monthly_net_profit = payload.monthly_net_profit
    target.monthly_contingency = payload.monthly_contingency
    target.include_13th = include_13th
    target.vacation_days_year = vacation_days_year
    target.planned_rest_days = planned_rest_days
    target.checkpoint_amount = float(payload.checkpoint_amount or 0)
    target.checkpoint_day = int(payload.checkpoint_day or 0)
    if target.checkpoint_amount <= 0 or target.checkpoint_day <= 0:
        target.checkpoint_amount = 0
        target.checkpoint_day = 0
    target.updated_at = datetime.utcnow()


@router.get("/config", response_model=GoalSettingsOut)
def get_config(
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if ano and mes:
        goals, is_custom = get_goals_for_month(db, user.id, ano, mes)
        return _goal_out(goals, year=ano, month=mes, is_custom=is_custom)
    settings = get_or_create_goals(db, user.id)
    return _goal_out(settings, is_custom=False)


@router.put("/config", response_model=GoalSettingsOut)
def update_config(
    payload: GoalSettingsIn,
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    target_year = payload.year or ano
    target_month = payload.month or mes

    if payload.save_as_default or not (target_year and target_month):
        settings = get_or_create_goals(db, user.id)
        _apply_goals(settings, payload)
        if target_year and target_month:
            monthly = (
                db.query(MonthlyGoal)
                .filter(
                    MonthlyGoal.user_id == user.id,
                    MonthlyGoal.year == target_year,
                    MonthlyGoal.month == target_month,
                )
                .first()
            )
            if monthly:
                db.delete(monthly)
        db.commit()
        db.refresh(settings)
        return _goal_out(
            settings, year=target_year, month=target_month, is_custom=False
        )

    monthly = (
        db.query(MonthlyGoal)
        .filter(
            MonthlyGoal.user_id == user.id,
            MonthlyGoal.year == target_year,
            MonthlyGoal.month == target_month,
        )
        .first()
    )
    if not monthly:
        monthly = MonthlyGoal(
            user_id=user.id,
            year=target_year,
            month=target_month,
        )
        db.add(monthly)
    _apply_goals(monthly, payload)

    get_or_create_goals(db, user.id)

    db.commit()
    db.refresh(monthly)
    return _goal_out(monthly, year=target_year, month=target_month, is_custom=True)


@router.delete("/config", response_model=GoalSettingsOut)
def reset_config(
    ano: int = Query(...),
    mes: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    monthly = (
        db.query(MonthlyGoal)
        .filter(
            MonthlyGoal.user_id == user.id,
            MonthlyGoal.year == ano,
            MonthlyGoal.month == mes,
        )
        .first()
    )
    if monthly:
        db.delete(monthly)
        db.commit()

    settings = get_or_create_goals(db, user.id)
    return _goal_out(settings, year=ano, month=mes, is_custom=False)


@router.get("/calculo", response_model=MetasOut)
def get_calculo(
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    return calcular_metas(db, user.id, ano or today.year, mes or today.month)

