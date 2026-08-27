from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import VariableExpense
from ..schemas import VariableExpenseIn, VariableExpenseOut
from ..services.calculos import month_range

router = APIRouter()


@router.get("", response_model=list[VariableExpenseOut])
def list_gastos_variaveis(
    ano: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
):
    today = datetime.now()
    year = ano or today.year
    month = mes or today.month
    start, end = month_range(year, month)
    return (
        db.query(VariableExpense)
        .filter(VariableExpense.date >= start, VariableExpense.date <= end)
        .order_by(VariableExpense.date.desc(), VariableExpense.id.desc())
        .all()
    )


@router.post("", response_model=VariableExpenseOut, status_code=201)
def create_gasto_variavel(payload: VariableExpenseIn, db: Session = Depends(get_db)):
    item = VariableExpense(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{expense_id}", status_code=204)
def delete_gasto_variavel(expense_id: int, db: Session = Depends(get_db)):
    item = db.query(VariableExpense).filter(VariableExpense.id == expense_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Gasto variável não encontrado")
    db.delete(item)
    db.commit()
