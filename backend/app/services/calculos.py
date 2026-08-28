from calendar import monthrange
from datetime import date

from sqlalchemy.orm import Session

from ..models import DailyEarning, FixedExpense, FixedExpensePayment, VariableExpense
from . import get_goals_for_month, get_or_create_goals, get_or_create_routine
from .agenda import dates_in_month, load_overrides, parse_weekdays, working_dates


def _round_money(value: float) -> float:
    return round(float(value or 0), 2)


def month_range(year: int, month: int) -> tuple[date, date]:
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def total_fixed_expenses(db: Session, user_id: int, year: int | None = None, month: int | None = None) -> float:
    rows = db.query(FixedExpense).filter(FixedExpense.user_id == user_id).all()
    total = sum(item.amount for item in rows)
    return _round_money(total)


def calcular_metas(
    db: Session, user_id: int, year: int | None = None, month: int | None = None
) -> dict:
    """
    Meta bruta = Gastos Fixos + Lucro Líquido desejado + Reserva de Imprevistos.
    Meta diária = total / dias trabalhados no mês.
    Meta semanal = meta diária * dias por semana.
    Meta por hora = meta diária / horas trabalhadas por dia.
    Os dias do mês vêm do calendário (dias da semana marcados + ajustes pontuais).
    """
    today = date.today()
    year = year or today.year
    month = month or today.month
    routine = get_or_create_routine(db, user_id)
    settings, is_custom = get_goals_for_month(db, user_id, year, month)
    gastos_fixos = total_fixed_expenses(db, user_id, year, month)

    weekdays = parse_weekdays(getattr(routine, "weekdays", None))
    start, end = month_range(year, month)
    overrides = load_overrides(db, user_id, start, end)
    dias_calendario = working_dates(year, month, weekdays, overrides)
    dias = max(len(dias_calendario), 1)
    dias_semana = max(len(weekdays), 1)
    horas = max(routine.hours_per_day, 0.1)

    total = gastos_fixos + settings.monthly_net_profit + settings.monthly_contingency
    meta_diaria = total / dias
    meta_semanal = meta_diaria * dias_semana
    meta_hora = meta_diaria / horas
    custo_fixo_diario = gastos_fixos / dias

    return {
        "gastos_fixos_mensal": _round_money(gastos_fixos),
        "lucro_liquido_alvo": _round_money(settings.monthly_net_profit),
        "reserva_imprevistos": _round_money(settings.monthly_contingency),
        "total_necessario": _round_money(total),
        "custo_fixo_diario": _round_money(custo_fixo_diario),
        "dias_trabalhados_mes": len(dias_calendario),
        "dias_por_semana": len(weekdays),
        "horas_por_dia": routine.hours_per_day,
        "meta_bruta_mensal": _round_money(total),
        "meta_bruta_semanal": _round_money(meta_semanal),
        "meta_bruta_diaria": _round_money(meta_diaria),
        "meta_por_hora": _round_money(meta_hora),
        "formula": (
            "(Gastos Fixos + Lucro Líquido + Reserva de Imprevistos) "
            "/ Dias trabalhados no mês"
        ),
        "is_custom": is_custom,
        "ano": year,
        "mes": month,
    }


def progresso_do_dia(ganho: float, meta_diaria: float) -> dict:
    meta = max(meta_diaria, 0)
    faltam = max(meta - ganho, 0)
    pct = 100.0 if meta == 0 and ganho > 0 else (0.0 if meta == 0 else (ganho / meta) * 100)
    return {
        "meta_diaria": _round_money(meta),
        "atingida": ganho >= meta and meta > 0,
        "faltam": _round_money(faltam),
        "progresso_pct": _round_money(min(pct, 999)),
    }


def montar_dashboard(db: Session, user_id: int, year: int, month: int) -> dict:
    metas = calcular_metas(db, user_id, year, month)
    start, end = month_range(year, month)

    earnings = (
        db.query(DailyEarning)
        .filter(
            DailyEarning.user_id == user_id,
            DailyEarning.date >= start,
            DailyEarning.date <= end,
        )
        .all()
    )
    variables = (
        db.query(VariableExpense)
        .filter(
            VariableExpense.user_id == user_id,
            VariableExpense.date >= start,
            VariableExpense.date <= end,
        )
        .all()
    )
    expenses = db.query(FixedExpense).filter(FixedExpense.user_id == user_id).all()
    payments = (
        db.query(FixedExpensePayment)
        .filter(FixedExpensePayment.year == year, FixedExpensePayment.month == month)
        .all()
    )
    paid_map = {p.expense_id: p.paid for p in payments}

    faturamento = sum(e.gross_amount for e in earnings)
    km_total = sum(e.km_driven for e in earnings)
    gastos_variaveis = sum(v.amount for v in variables)

    contas_pagas = 0
    contas_pendentes = 0
    valor_pago = 0.0
    valor_pendente = 0.0
    for expense in expenses:
        if paid_map.get(expense.id):
            contas_pagas += 1
            valor_pago += expense.amount
        else:
            contas_pendentes += 1
            valor_pendente += expense.amount

    gastos_totais = valor_pago + gastos_variaveis
    lucro_liquido = faturamento - gastos_totais
    meta_mensal = metas["meta_bruta_mensal"]
    meta_pct = 0.0 if meta_mensal == 0 else (faturamento / meta_mensal) * 100
    pagamentos_pct = 0.0 if not expenses else (contas_pagas / len(expenses)) * 100

    today = date.today()
    ganho_hoje = next((e.gross_amount for e in earnings if e.date == today), 0.0)
    hoje_status = progresso_do_dia(ganho_hoje, metas["meta_bruta_diaria"])

    return {
        "periodo": {"ano": year, "mes": month},
        "metas": metas,
        "realizado": {
            "faturamento_uber": _round_money(faturamento),
            "gastos_fixos_pagos": _round_money(valor_pago),
            "gastos_fixos_pendentes": _round_money(valor_pendente),
            "gastos_variaveis": _round_money(gastos_variaveis),
            "gastos_totais": _round_money(gastos_totais),
            "lucro_liquido": _round_money(lucro_liquido),
            "km_total": _round_money(km_total),
            "dias_com_ganho": len(earnings),
        },
        "progresso": {
            "meta_mensal_pct": _round_money(meta_pct),
            "pagamentos_pct": _round_money(pagamentos_pct),
            "contas_pagas": contas_pagas,
            "contas_pendentes": contas_pendentes,
            "valor_pago": _round_money(valor_pago),
            "valor_pendente": _round_money(valor_pendente),
        },
        "hoje": {
            "data": today.isoformat(),
            "ganho": _round_money(ganho_hoje),
            **hoje_status,
        },
    }


def _empty_day(iso: str) -> dict:
    return {
        "date": iso,
        "ganhos": 0.0,
        "gastos": 0.0,
        "km": 0.0,
        "lucro": 0.0,
        "tem_ganho": False,
        "tem_gasto": False,
        "lancamentos": [],
    }


def montar_historico(db: Session, user_id: int, year: int, month: int) -> dict:
    start, end = month_range(year, month)
    days = {day.isoformat(): _empty_day(day.isoformat()) for day in dates_in_month(year, month)}

    earnings = (
        db.query(DailyEarning)
        .filter(
            DailyEarning.user_id == user_id,
            DailyEarning.date >= start,
            DailyEarning.date <= end,
        )
        .order_by(DailyEarning.date)
        .all()
    )
    variables = (
        db.query(VariableExpense)
        .filter(
            VariableExpense.user_id == user_id,
            VariableExpense.date >= start,
            VariableExpense.date <= end,
        )
        .order_by(VariableExpense.date)
        .all()
    )
    expenses = db.query(FixedExpense).filter(FixedExpense.user_id == user_id).all()

    for earning in earnings:
        day = days[earning.date.isoformat()]
        day["ganhos"] += earning.gross_amount
        day["km"] += earning.km_driven
        day["tem_ganho"] = True
        day["lancamentos"].append(
            {
                "kind": "ganho",
                "title": earning.notes or "Ganho do dia",
                "amount": _round_money(earning.gross_amount),
            }
        )

    for item in variables:
        day = days[item.date.isoformat()]
        day["gastos"] += item.amount
        day["tem_gasto"] = True
        day["lancamentos"].append(
            {
                "kind": "gasto",
                "title": item.description or item.type,
                "amount": _round_money(item.amount),
            }
        )

    for expense in expenses:
        if not expense.due_date:
            continue
        iso = expense.due_date.isoformat()
        if iso not in days:
            continue
        day = days[iso]
        day["gastos"] += expense.amount
        day["tem_gasto"] = True
        day["lancamentos"].append(
            {
                "kind": "gasto",
                "title": expense.name,
                "amount": _round_money(expense.amount),
            }
        )

    for day in days.values():
        day["ganhos"] = _round_money(day["ganhos"])
        day["gastos"] = _round_money(day["gastos"])
        day["km"] = _round_money(day["km"])
        day["lucro"] = _round_money(day["ganhos"] - day["gastos"])

    return {
        "periodo": {"ano": year, "mes": month},
        "dias": list(days.values()),
    }
