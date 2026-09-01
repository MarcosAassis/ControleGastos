from calendar import monthrange
from datetime import date, datetime

from sqlalchemy.orm import Session

from ..models import DailyEarning, FixedExpense, FixedExpensePayment, VariableExpense
from . import get_goals_for_month, get_or_create_goals, get_or_create_routine
from .agenda import dates_in_month, load_overrides, parse_weekdays, working_dates
from .combustivel import montar_consumo_combustivel
from .provisao import campos_provisao, dias_apos_folgas, montar_provisao


def _round_money(value: float) -> float:
    return round(float(value or 0), 2)


def _as_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    raw = str(value)[:10]
    try:
        return date.fromisoformat(raw)
    except ValueError:
        return None


def _earning_amount(item) -> float:
    if isinstance(item, dict):
        return float(item.get("gross_amount") or 0)
    return float(getattr(item, "gross_amount", 0) or 0)


def montar_marco(
    year: int,
    month: int,
    amount: float,
    day: int,
    working: list[date],
    earnings: list,
    today: date,
    meta_diaria_base: float,
) -> dict:
    amount = max(float(amount or 0), 0)
    last = monthrange(year, month)[1]
    try:
        day = int(day or 0)
    except (TypeError, ValueError):
        day = 0
    day = max(0, min(day, last))
    base = _round_money(meta_diaria_base)
    empty = {
        "ativo": False,
        "cobrando": False,
        "em_andamento": False,
        "vencido": False,
        "atingida": False,
        "dia": 0,
        "valor": 0.0,
        "data": None,
        "realizado": 0.0,
        "faltam": 0.0,
        "progresso_pct": 0.0,
        "dias_restantes": 0,
        "meta_diaria": base,
    }
    if amount <= 0 or day <= 0:
        return empty

    deadline = date(year, month, day)
    realized = 0.0
    for item in earnings:
        item_date = _as_date(getattr(item, "date", None) if not isinstance(item, dict) else item.get("date"))
        if item_date and item_date <= min(today, deadline):
            realized += _earning_amount(item)

    same_month = today.year == year and today.month == month
    em_andamento = same_month and today <= deadline
    vencido = (today.year, today.month, today.day) > (year, month, day)
    atingida = realized + 0.001 >= amount
    faltam = max(amount - realized, 0.0)
    remaining = [d for d in working if today <= d <= deadline]
    cobrando = em_andamento and not atingida and len(remaining) > 0
    meta_diaria = (faltam / len(remaining)) if cobrando else base
    progresso = 0.0 if amount == 0 else (realized / amount) * 100
    return {
        "ativo": True,
        "cobrando": cobrando,
        "em_andamento": em_andamento,
        "vencido": vencido,
        "atingida": atingida,
        "dia": day,
        "valor": _round_money(amount),
        "data": deadline.isoformat(),
        "realizado": _round_money(realized),
        "faltam": _round_money(faltam),
        "progresso_pct": _round_money(min(progresso, 999)),
        "dias_restantes": len(remaining),
        "meta_diaria": _round_money(meta_diaria),
    }


def month_range(year: int, month: int) -> tuple[date, date]:
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def total_fixed_expenses(db: Session, user_id: int, year: int, month: int) -> float:
    rows = db.query(FixedExpense).filter(FixedExpense.user_id == user_id).all()
    total = 0.0
    for item in rows:
        if item.due_date:
            if item.due_date.year == year and item.due_date.month == month:
                total += item.amount
        else:
            total += item.amount
    return _round_money(total)


def calcular_metas(
    db: Session, user_id: int, year: int | None = None, month: int | None = None
) -> dict:
    """
    Meta bruta = Gastos Fixos + Lucro Líquido + Reserva + Provisão de 13º/férias.
    Meta diária = total / dias trabalhados no mês (calendário menos folgas planejadas).
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
    include_13th, vacation_days_year, planned_rest_days = campos_provisao(settings)
    dias_semana = max(len(weekdays), 1)
    provisao = montar_provisao(
        settings.monthly_net_profit, include_13th, vacation_days_year, dias_semana
    )
    dias, folgas_aplicadas = dias_apos_folgas(len(dias_calendario), planned_rest_days)
    horas = max(routine.hours_per_day, 0.1)

    total = (
        gastos_fixos
        + settings.monthly_net_profit
        + settings.monthly_contingency
        + provisao["provisao_descanso"]
    )
    meta_diaria_base = total / dias
    earnings = (
        db.query(DailyEarning)
        .filter(
            DailyEarning.user_id == user_id,
            DailyEarning.date >= start,
            DailyEarning.date <= end,
        )
        .all()
    )
    try:
        checkpoint_amount = float(getattr(settings, "checkpoint_amount", 0) or 0)
    except (TypeError, ValueError):
        checkpoint_amount = 0.0
    try:
        checkpoint_day = int(getattr(settings, "checkpoint_day", 0) or 0)
    except (TypeError, ValueError):
        checkpoint_day = 0
    marco = montar_marco(
        year,
        month,
        checkpoint_amount,
        checkpoint_day,
        dias_calendario,
        earnings,
        today,
        meta_diaria_base,
    )
    meta_diaria = marco["meta_diaria"]
    meta_semanal = meta_diaria * dias_semana
    meta_hora = meta_diaria / horas
    custo_fixo_diario = gastos_fixos / dias

    return {
        "gastos_fixos_mensal": _round_money(gastos_fixos),
        "lucro_liquido_alvo": _round_money(settings.monthly_net_profit),
        "reserva_imprevistos": _round_money(settings.monthly_contingency),
        "total_necessario": _round_money(total),
        "custo_fixo_diario": _round_money(custo_fixo_diario),
        "dias_trabalhados_mes": dias,
        "dias_por_semana": len(weekdays),
        "horas_por_dia": routine.hours_per_day,
        "meta_bruta_mensal": _round_money(total),
        "meta_bruta_semanal": _round_money(meta_semanal),
        "meta_bruta_diaria": _round_money(meta_diaria),
        "meta_diaria_base": _round_money(meta_diaria_base),
        "meta_por_hora": _round_money(meta_hora),
        "formula": (
            "(Gastos Fixos + Lucro Líquido + Reserva + Provisão 13º/férias) "
            "/ Dias trabalhados no mês"
        ),
        "is_custom": is_custom,
        "ano": year,
        "mes": month,
        "include_13th": include_13th,
        "vacation_days_year": vacation_days_year,
        "planned_rest_days": planned_rest_days,
        "dias_calendario": len(dias_calendario),
        "folgas_aplicadas": folgas_aplicadas,
        "dias_uteis_ano": provisao["dias_uteis_ano"],
        "provisao_13": provisao["provisao_13"],
        "provisao_ferias": provisao["provisao_ferias"],
        "provisao_descanso": provisao["provisao_descanso"],
        "checkpoint_amount": _round_money(checkpoint_amount),
        "checkpoint_day": checkpoint_day if checkpoint_amount and checkpoint_day else 0,
        "marco": marco,
    }


def montar_eficiencia(
    faturamento: float,
    km_total: float,
    horas_total: float,
    faturamento_com_horas: float,
    meta_por_hora: float,
) -> dict:
    rs_km = (faturamento / km_total) if km_total else None
    rs_hora = (faturamento_com_horas / horas_total) if horas_total else None
    comparacao = None
    if rs_hora is not None and meta_por_hora:
        comparacao = (rs_hora / meta_por_hora) * 100
    badge = None
    if comparacao is not None:
        if comparacao >= 110:
            badge = "excelente"
        elif comparacao >= 85:
            badge = "media"
        else:
            badge = "abaixo"
    return {
        "rs_por_km": _round_money(rs_km) if rs_km is not None else None,
        "rs_por_hora": _round_money(rs_hora) if rs_hora is not None else None,
        "horas_total": _round_money(horas_total),
        "meta_por_hora": _round_money(meta_por_hora),
        "comparacao_hora_pct": _round_money(comparacao) if comparacao is not None else None,
        "badge": badge,
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
    month_expenses = [
        e for e in expenses
        if not e.due_date or (e.due_date.year == year and e.due_date.month == month)
    ]
    payments = (
        db.query(FixedExpensePayment)
        .filter(FixedExpensePayment.year == year, FixedExpensePayment.month == month)
        .all()
    )
    paid_map = {p.expense_id: p.paid for p in payments}

    faturamento = sum(e.gross_amount for e in earnings)
    km_total = sum(e.km_driven for e in earnings)
    horas_total = sum(float(e.hours_worked or 0) for e in earnings)
    faturamento_com_horas = sum(
        e.gross_amount for e in earnings if e.hours_worked
    )
    gastos_variaveis = sum(v.amount for v in variables)

    contas_pagas = 0
    contas_pendentes = 0
    valor_pago = 0.0
    valor_pendente = 0.0
    for expense in month_expenses:
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
    pagamentos_pct = 0.0 if not month_expenses else (contas_pagas / len(month_expenses)) * 100

    today = date.today()
    today_earning = next((e for e in earnings if e.date == today), None)
    ganho_hoje = today_earning.gross_amount if today_earning else 0.0
    km_hoje = today_earning.km_driven if today_earning else 0.0
    horas_hoje = today_earning.hours_worked if today_earning else None
    obs_hoje = today_earning.notes if today_earning else ""
    hoje_status = progresso_do_dia(ganho_hoje, metas["meta_bruta_diaria"])
    eficiencia = montar_eficiencia(
        faturamento,
        km_total,
        horas_total,
        faturamento_com_horas,
        metas["meta_por_hora"],
    )
    horas_hoje_num = float(horas_hoje or 0)
    eficiencia_hoje = montar_eficiencia(
        ganho_hoje,
        km_hoje,
        horas_hoje_num,
        ganho_hoje if horas_hoje else 0.0,
        metas["meta_por_hora"],
    )

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
            "horas_total": _round_money(horas_total),
            "dias_com_ganho": len(earnings),
        },
        "eficiencia": eficiencia,
        "combustivel": montar_consumo_combustivel(
            [v for v in variables if (v.type or "").lower() == "combustivel"],
            km_total,
        ),
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
            "km": _round_money(km_hoje),
            "horas": horas_hoje,
            "notes": obs_hoje,
            "tem_lancamento": today_earning is not None,
            "eficiencia": eficiencia_hoje,
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
