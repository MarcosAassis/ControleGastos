export function clampInt(value: unknown, lo: number, hi: number): number {
  const number = Number.parseInt(String(value ?? 0), 10);
  const safe = Number.isFinite(number) ? number : 0;
  return Math.max(lo, Math.min(safe, hi));
}

export function camposProvisao(settings: {
  include_13th?: boolean;
  vacation_days_year?: number;
  planned_rest_days?: number;
}): { include13th: boolean; vacationDaysYear: number; plannedRestDays: number } {
  return {
    include13th: Boolean(settings?.include_13th),
    vacationDaysYear: clampInt(settings?.vacation_days_year, 0, 60),
    plannedRestDays: clampInt(settings?.planned_rest_days, 0, 20),
  };
}

export function montarProvisao(
  lucro: number,
  include13th: boolean,
  vacationDaysYear: number,
  daysPerWeek: number
) {
  const net = Number(lucro) || 0;
  const diasAno = Math.max((Number(daysPerWeek) || 0) * 52, 1);
  const ferias = clampInt(vacationDaysYear, 0, 60);
  const provisao13 = include13th ? net / 12 : 0;
  const provisaoFerias = ferias && net ? net * (ferias / diasAno) * (4 / 3) : 0;
  return {
    include_13th: Boolean(include13th),
    vacation_days_year: ferias,
    dias_uteis_ano: diasAno,
    provisao_13: Math.round(provisao13 * 100) / 100,
    provisao_ferias: Math.round(provisaoFerias * 100) / 100,
    provisao_descanso: Math.round((provisao13 + provisaoFerias) * 100) / 100,
  };
}

export function diasAposFolgas(
  diasCalendario: number,
  plannedRestDays: number
): { dias: number; aplicadas: number } {
  if (diasCalendario <= 0) return { dias: 1, aplicadas: 0 };
  const applied = Math.min(clampInt(plannedRestDays, 0, 20), Math.max(diasCalendario - 1, 0));
  return { dias: Math.max(diasCalendario - applied, 1), aplicadas: applied };
}
