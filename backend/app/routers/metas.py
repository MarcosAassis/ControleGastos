from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import MonthlyGoal, User
from ..schemas import GoalSettingsIn, GoalSettingsOut, MetasOut
from ..services import get_goals_for_month, get_or_create_goals
from ..services.calculos import calcular_metas

router = APIRouter()


@router.get("/config", response_model=GoalSettingsOut)
def get_config(
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if ano and mes:
        goals, is_custom = get_goals_for_month(db, user.id, ano, mes)
        return GoalSettingsOut(
            id=getattr(goals, "id", None),
            monthly_net_profit=goals.monthly_net_profit,
            monthly_contingency=goals.monthly_contingency,
            year=ano,
            month=mes,
            is_custom=is_custom,
            updated_at=goals.updated_at,
        )
    settings = get_or_create_goals(db, user.id)
    return GoalSettingsOut(
        id=settings.id,
        monthly_net_profit=settings.monthly_net_profit,
        monthly_contingency=settings.monthly_contingency,
        is_custom=False,
        updated_at=settings.updated_at,
    )


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
        settings.monthly_net_profit = payload.monthly_net_profit
        settings.monthly_contingency = payload.monthly_contingency
        settings.updated_at = datetime.utcnow()
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
        return GoalSettingsOut(
            id=settings.id,
            monthly_net_profit=settings.monthly_net_profit,
            monthly_contingency=settings.monthly_contingency,
            year=target_year,
            month=target_month,
            is_custom=False,
            updated_at=settings.updated_at,
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
            monthly_net_profit=payload.monthly_net_profit,
            monthly_contingency=payload.monthly_contingency,
        )
        db.add(monthly)
    else:
        monthly.monthly_net_profit = payload.monthly_net_profit
        monthly.monthly_contingency = payload.monthly_contingency
        monthly.updated_at = datetime.utcnow()

    # Garantir que a configuração base exista para integridade
    get_or_create_goals(db, user.id)

    db.commit()
    db.refresh(monthly)
    return GoalSettingsOut(
        id=monthly.id,
        monthly_net_profit=monthly.monthly_net_profit,
        monthly_contingency=monthly.monthly_contingency,
        year=target_year,
        month=target_month,
        is_custom=True,
        updated_at=monthly.updated_at,
    )


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
    return GoalSettingsOut(
        id=settings.id,
        monthly_net_profit=settings.monthly_net_profit,
        monthly_contingency=settings.monthly_contingency,
        year=ano,
        month=mes,
        is_custom=False,
        updated_at=settings.updated_at,
    )


@router.get("/calculo", response_model=MetasOut)
def get_calculo(
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    return calcular_metas(db, user.id, ano or today.year, mes or today.month)

