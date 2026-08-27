from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..services.calculos import montar_dashboard

router = APIRouter()


@router.get("")
def get_dashboard(
    ano: int | None = Query(default=None),
    mes: int | None = Query(default=None, ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    return montar_dashboard(db, user.id, ano or today.year, mes or today.month)
