from __future__ import annotations

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from ..models import VariableExpense


def _round_money(value: float) -> float:
    return round(float(value or 0), 2)


def _is_fuel(item: VariableExpense) -> bool:
    return (item.type or "").lower() == "combustivel"


def previous_fuel_fill(db: Session, user_id: int, item: VariableExpense) -> VariableExpense | None:
    return (
        db.query(VariableExpense)
        .filter(
            VariableExpense.user_id == user_id,
            func.lower(VariableExpense.type) == "combustivel",
            VariableExpense.odometer_km.is_not(None),
            VariableExpense.id != item.id,
            or_(
                VariableExpense.date < item.date,
                and_(VariableExpense.date == item.date, VariableExpense.id < item.id),
            ),
        )
        .order_by(VariableExpense.date.desc(), VariableExpense.id.desc())
        .first()
    )


def enrich_variable(db: Session, user_id: int, item: VariableExpense) -> dict:
    price = None
    km_since = None
    km_l = None
    rs_km = None
    if _is_fuel(item) and item.liters:
        price = item.amount / item.liters
        prev = previous_fuel_fill(db, user_id, item)
        if item.odometer_km is not None and prev and prev.odometer_km is not None:
            delta = float(item.odometer_km) - float(prev.odometer_km)
            if delta > 0:
                km_since = delta
                km_l = delta / item.liters
                rs_km = item.amount / delta
    return {
        "id": item.id,
        "date": item.date,
        "type": item.type,
        "description": item.description or "",
        "amount": item.amount,
        "liters": item.liters,
        "odometer_km": item.odometer_km,
        "fuel_kind": item.fuel_kind,
        "created_at": item.created_at,
        "price_per_liter": _round_money(price) if price is not None else None,
        "km_since_last": _round_money(km_since) if km_since is not None else None,
        "km_per_liter": _round_money(km_l) if km_l is not None else None,
        "rs_per_km": _round_money(rs_km) if rs_km is not None else None,
    }


def montar_consumo_combustivel(fuel_rows: list, km_total: float) -> dict:
    litros = sum(float(item.liters or 0) for item in fuel_rows)
    gasto = sum(float(item.amount or 0) for item in fuel_rows)
    km_l = (km_total / litros) if litros and km_total else None
    rs_km = (gasto / km_total) if km_total and gasto else None
    preco_litro = (gasto / litros) if litros else None
    return {
        "abastecimentos": len(fuel_rows),
        "litros": _round_money(litros) if litros else 0,
        "gasto": _round_money(gasto),
        "km_per_liter": _round_money(km_l) if km_l is not None else None,
        "rs_per_km": _round_money(rs_km) if rs_km is not None else None,
        "price_per_liter": _round_money(preco_litro) if preco_litro is not None else None,
    }
