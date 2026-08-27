from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.calculos import montar_dashboard

router = APIRouter()


@router.get("")
def get_dashboard(
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
):
    today = date.today()
    return montar_dashboard(db, ano or today.year, mes or today.month)
