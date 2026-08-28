def clamp_int(value, lo: int, hi: int) -> int:
    try:
        number = int(value or 0)
    except (TypeError, ValueError):
        number = 0
    return max(lo, min(number, hi))


def campos_provisao(settings) -> tuple[bool, int, int]:
    include_13th = bool(getattr(settings, "include_13th", False))
    vacation_days_year = clamp_int(getattr(settings, "vacation_days_year", 0), 0, 60)
    planned_rest_days = clamp_int(getattr(settings, "planned_rest_days", 0), 0, 20)
    return include_13th, vacation_days_year, planned_rest_days


def montar_provisao(
    lucro: float, include_13th: bool, vacation_days_year: int, days_per_week: int
) -> dict:
    lucro = float(lucro or 0)
    dias_ano = max(int(days_per_week or 0) * 52, 1)
    ferias = clamp_int(vacation_days_year, 0, 60)
    provisao_13 = lucro / 12.0 if include_13th else 0.0
    provisao_ferias = lucro * (ferias / dias_ano) * (4.0 / 3.0) if ferias and lucro else 0.0
    return {
        "include_13th": bool(include_13th),
        "vacation_days_year": ferias,
        "dias_uteis_ano": dias_ano,
        "provisao_13": round(provisao_13, 2),
        "provisao_ferias": round(provisao_ferias, 2),
        "provisao_descanso": round(provisao_13 + provisao_ferias, 2),
    }


def dias_apos_folgas(dias_calendario: int, planned_rest_days: int) -> tuple[int, int]:
    if dias_calendario <= 0:
        return 1, 0
    applied = min(clamp_int(planned_rest_days, 0, 20), max(dias_calendario - 1, 0))
    return max(dias_calendario - applied, 1), applied
