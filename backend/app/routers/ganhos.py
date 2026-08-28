from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import DailyEarning, User
from ..schemas import DailyEarningIn, DailyEarningOut
from ..services.calculos import calcular_metas, month_range, progresso_do_dia

router = APIRouter()


def _with_goal(earning: DailyEarning, meta_diaria: float) -> dict:
    status = progresso_do_dia(earning.gross_amount, meta_diaria)
    return {
        "id": earning.id,
        "date": earning.date,
        "gross_amount": earning.gross_amount,
        "km_driven": earning.km_driven,
        "hours_worked": earning.hours_worked,
        "notes": earning.notes,
        "created_at": earning.created_at,
        "updated_at": earning.updated_at,
        **status,
    }


@router.get("", response_model=list[DailyEarningOut])
def list_ganhos(
    ano: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = datetime.now()
    year = ano or today.year
    month = mes or today.month
    start, end = month_range(year, month)
    meta_diaria = calcular_metas(db, user.id, year, month)["meta_bruta_diaria"]
    rows = (
        db.query(DailyEarning)
        .filter(
            DailyEarning.user_id == user.id,
            DailyEarning.date >= start,
            DailyEarning.date <= end,
        )
        .order_by(DailyEarning.date.desc())
        .all()
    )
    return [_with_goal(item, meta_diaria) for item in rows]


@router.post("", response_model=DailyEarningOut)
def upsert_ganho(
    payload: DailyEarningIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    earning = (
        db.query(DailyEarning)
        .filter(DailyEarning.user_id == user.id, DailyEarning.date == payload.date)
        .first()
    )
    if earning:
        earning.gross_amount = payload.gross_amount
        earning.km_driven = payload.km_driven
        earning.hours_worked = payload.hours_worked
        earning.notes = payload.notes
        earning.updated_at = datetime.utcnow()
    else:
        earning = DailyEarning(**payload.model_dump(), user_id=user.id)
        db.add(earning)
    db.commit()
    db.refresh(earning)
    meta_diaria = calcular_metas(db, user.id, earning.date.year, earning.date.month)[
        "meta_bruta_diaria"
    ]
    return _with_goal(earning, meta_diaria)


@router.delete("/{earning_id}", status_code=204)
def delete_ganho(
    earning_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    earning = (
        db.query(DailyEarning)
        .filter(DailyEarning.id == earning_id, DailyEarning.user_id == user.id)
        .first()
    )
    if not earning:
        raise HTTPException(status_code=404, detail="Ganho não encontrado")
    db.delete(earning)
    db.commit()
