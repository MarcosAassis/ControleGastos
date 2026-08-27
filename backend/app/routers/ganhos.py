from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DailyEarning
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
):
    today = datetime.now()
    year = ano or today.year
    month = mes or today.month
    start, end = month_range(year, month)
    meta_diaria = calcular_metas(db, year, month)["meta_bruta_diaria"]
    rows = (
        db.query(DailyEarning)
        .filter(DailyEarning.date >= start, DailyEarning.date <= end)
        .order_by(DailyEarning.date.desc())
        .all()
    )
    return [_with_goal(item, meta_diaria) for item in rows]


@router.post("", response_model=DailyEarningOut)
def upsert_ganho(payload: DailyEarningIn, db: Session = Depends(get_db)):
    earning = db.query(DailyEarning).filter(DailyEarning.date == payload.date).first()
    if earning:
        earning.gross_amount = payload.gross_amount
        earning.km_driven = payload.km_driven
        earning.notes = payload.notes
        earning.updated_at = datetime.utcnow()
    else:
        earning = DailyEarning(**payload.model_dump())
        db.add(earning)
    db.commit()
    db.refresh(earning)
    meta_diaria = calcular_metas(db, earning.date.year, earning.date.month)["meta_bruta_diaria"]
    return _with_goal(earning, meta_diaria)


@router.delete("/{earning_id}", status_code=204)
def delete_ganho(earning_id: int, db: Session = Depends(get_db)):
    earning = db.query(DailyEarning).filter(DailyEarning.id == earning_id).first()
    if not earning:
        raise HTTPException(status_code=404, detail="Ganho não encontrado")
    db.delete(earning)
    db.commit()
