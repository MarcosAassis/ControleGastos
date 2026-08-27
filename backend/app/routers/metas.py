from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import GoalSettingsIn, GoalSettingsOut, MetasOut
from ..services import get_or_create_goals
from ..services.calculos import calcular_metas

router = APIRouter()


@router.get("/config", response_model=GoalSettingsOut)
def get_config(db: Session = Depends(get_db)):
    return get_or_create_goals(db)


@router.put("/config", response_model=GoalSettingsOut)
def update_config(payload: GoalSettingsIn, db: Session = Depends(get_db)):
    settings = get_or_create_goals(db)
    settings.monthly_net_profit = payload.monthly_net_profit
    settings.monthly_contingency = payload.monthly_contingency
    settings.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/calculo", response_model=MetasOut)
def get_calculo(
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
):
    today = date.today()
    return calcular_metas(db, ano or today.year, mes or today.month)
