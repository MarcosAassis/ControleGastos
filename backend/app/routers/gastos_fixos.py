from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import FixedExpense, FixedExpensePayment, User
from ..schemas import FixedExpenseIn, FixedExpenseOut, PaymentToggleIn

router = APIRouter()


def _owned(db: Session, expense_id: int, user_id: int) -> FixedExpense:
    expense = (
        db.query(FixedExpense)
        .filter(FixedExpense.id == expense_id, FixedExpense.user_id == user_id)
        .first()
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto fixo não encontrado")
    return expense


def _with_payment_status(expense: FixedExpense, year: int, month: int) -> dict:
    payment = next(
        (p for p in expense.payments if p.year == year and p.month == month),
        None,
    )
    return {
        "id": expense.id,
        "name": expense.name,
        "amount": expense.amount,
        "category": expense.category,
        "due_date": expense.due_date,
        "created_at": expense.created_at,
        "paid": bool(payment and payment.paid),
    }


@router.get("", response_model=list[FixedExpenseOut])
def list_gastos_fixos(
    ano: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = datetime.now()
    year = ano or today.year
    month = mes or today.month
    expenses = (
        db.query(FixedExpense)
        .filter(FixedExpense.user_id == user.id)
        .order_by(FixedExpense.due_date.is_(None), FixedExpense.due_date.asc(), FixedExpense.name.asc())
        .all()
    )
    return [_with_payment_status(item, year, month) for item in expenses]


@router.post("", response_model=FixedExpenseOut, status_code=201)
def create_gasto_fixo(
    payload: FixedExpenseIn,
    ano: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = datetime.now()
    data = payload.model_dump()
    expense = FixedExpense(
        **data,
        user_id=user.id,
        due_day=data["due_date"].day if data.get("due_date") else None,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return _with_payment_status(expense, ano or today.year, mes or today.month)


@router.put("/{expense_id}", response_model=FixedExpenseOut)
def update_gasto_fixo(
    expense_id: int,
    payload: FixedExpenseIn,
    ano: int | None = None,
    mes: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    expense = _owned(db, expense_id, user.id)
    data = payload.model_dump()
    for key, value in data.items():
        setattr(expense, key, value)
    expense.due_day = data["due_date"].day if data.get("due_date") else None
    db.commit()
    db.refresh(expense)
    today = datetime.now()
    return _with_payment_status(expense, ano or today.year, mes or today.month)


@router.delete("/{expense_id}", status_code=204)
def delete_gasto_fixo(
    expense_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    expense = _owned(db, expense_id, user.id)
    db.delete(expense)
    db.commit()


@router.patch("/{expense_id}/pagamento", response_model=FixedExpenseOut)
def toggle_pagamento(
    expense_id: int,
    payload: PaymentToggleIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    expense = _owned(db, expense_id, user.id)
    payment = (
        db.query(FixedExpensePayment)
        .filter(
            FixedExpensePayment.expense_id == expense_id,
            FixedExpensePayment.year == payload.year,
            FixedExpensePayment.month == payload.month,
        )
        .first()
    )
    if not payment:
        payment = FixedExpensePayment(
            expense_id=expense_id,
            year=payload.year,
            month=payload.month,
            paid=payload.paid,
            paid_at=datetime.utcnow() if payload.paid else None,
        )
        db.add(payment)
    else:
        payment.paid = payload.paid
        payment.paid_at = datetime.utcnow() if payload.paid else None

    db.commit()
    db.refresh(expense)
    return _with_payment_status(expense, payload.year, payload.month)
