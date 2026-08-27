from calendar import monthrange
from datetime import date

from sqlalchemy.orm import Session

from ..models import DailyEarning, FixedExpense, FixedExpensePayment, VariableExpense
from . import get_or_create_goals, get_or_create_routine
from .agenda import load_overrides, parse_weekdays, working_dates


def _round_money(value: float) -> float:
    return round(float(value or 0), 2)


def month_range(year: int, month: int) -> tuple[date, date]:
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def total_fixed_expenses(db: Session, user_id: int) -> float:
    rows = db.query(FixedExpense).filter(FixedExpense.user_id == user_id).all()
    return _round_money(sum(item.amount for item in rows))


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
    settings = get_or_create_goals(db, user_id)
    gastos_fixos = total_fixed_expenses(db, user_id)

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
