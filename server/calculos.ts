import { dbInstance, VariableExpense } from "./db";
import { camposProvisao, diasAposFolgas, montarProvisao } from "./provisao";

export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function monthRange(year: number, month: number): { start: string; end: string; daysInMonth: number } {
  const lastDay = new Date(year, month, 0).getDate();
  const m = String(month).padStart(2, "0");
  return {
    start: `${year}-${m}-01`,
    end: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
    daysInMonth: lastDay,
  };
}

export function getDatesInMonth(year: number, month: number): string[] {
  const lastDay = new Date(year, month, 0).getDate();
  const m = String(month).padStart(2, "0");
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${year}-${m}-${String(d).padStart(2, "0")}`);
  }
  return dates;
}

export function getOrCreateRoutine(userId: number) {
  const { db } = dbInstance;
  let routine = db.work_routines.find((r) => r.user_id === userId);
  if (!routine) {
    routine = {
      id: dbInstance.getNextId("work_routines"),
      user_id: userId,
      weekdays: [0, 1, 2, 3, 4], // 0=Segunda ... 6=Domingo
      hours_per_day: 8.0,
      updated_at: new Date().toISOString(),
    };
    db.work_routines.push(routine);
    dbInstance.save();
  }
  return routine;
}

export function getOrCreateGoals(userId: number) {
  const { db } = dbInstance;
  let goals = db.goal_settings.find((g) => g.user_id === userId);
  if (!goals) {
    goals = {
      id: dbInstance.getNextId("goal_settings"),
      user_id: userId,
      monthly_net_profit: 4000.0,
      monthly_contingency: 500.0,
      updated_at: new Date().toISOString(),
    };
    db.goal_settings.push(goals);
    dbInstance.save();
  }
  return goals;
}

export function getGoalsForMonth(userId: number, year: number, month: number) {
  const { db } = dbInstance;
  const custom = db.monthly_goals.find(
    (g) => g.user_id === userId && g.year === year && g.month === month
  );
  if (custom) {
    return { goals: custom, isCustom: true };
  }
  return { goals: getOrCreateGoals(userId), isCustom: false };
}

// Convert JavaScript getDay() (0=Sun, 1=Mon... 6=Sat) to Python/ISO weekday (0=Mon, 1=Tue... 6=Sun)
export function getIsoWeekday(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return (jsDay + 6) % 7;
}

export function getWorkingDates(
  year: number,
  month: number,
  weekdays: number[],
  overridesMap: Map<string, boolean>
): string[] {
  const dates = getDatesInMonth(year, month);
  return dates.filter((d) => {
    if (overridesMap.has(d)) {
      return overridesMap.get(d)!;
    }
    const isoDay = getIsoWeekday(d);
    return weekdays.includes(isoDay);
  });
}

export function totalFixedExpenses(userId: number, year: number, month: number): number {
  const { db } = dbInstance;
  const rows = db.fixed_expenses.filter((e) => e.user_id === userId);
  let total = 0;
  for (const item of rows) {
    if (item.due_date) {
      const [y, m] = item.due_date.split("-").map(Number);
      if (y === year && m === month) {
        total += item.amount;
      }
    } else {
      total += item.amount;
    }
  }
  return roundMoney(total);
}

export function montarMarco(
  year: number,
  month: number,
  amount: number,
  day: number,
  working: string[],
  earnings: { date: string; gross_amount: number }[],
  todayISO: string,
  metaDiariaBase: number,
  totalMensal: number
) {
  const lastDay = new Date(year, month, 0).getDate();
  const valor = Math.max(Number(amount) || 0, 0);
  let limite = Number.parseInt(String(day || 0), 10);
  if (!Number.isFinite(limite)) limite = 0;
  limite = Math.max(0, Math.min(limite, lastDay));
  const base = roundMoney(metaDiariaBase);
  const empty = {
    ativo: false,
    cobrando: false,
    em_andamento: false,
    vencido: false,
    atingida: false,
    dia: 0,
    valor: 0,
    data: null as string | null,
    realizado: 0,
    faltam: 0,
    progresso_pct: 0,
    dias_restantes: 0,
    meta_diaria: base,
    recalculando_mes: false,
  };
  if (valor <= 0 || limite <= 0) return empty;

  const m = String(month).padStart(2, "0");
  const deadline = `${year}-${m}-${String(limite).padStart(2, "0")}`;
  const corte = todayISO < deadline ? todayISO : deadline;
  const somaAte = (limiteISO: string) =>
    earnings
      .filter((item) => item.date <= limiteISO)
      .reduce((sum, item) => sum + (item.gross_amount || 0), 0);
  const realizado = somaAte(corte);
  const sameMonth = todayISO.slice(0, 7) === `${year}-${m}`;
  const emAndamento = sameMonth && todayISO <= deadline;
  const vencido = todayISO > deadline;
  const atingida = realizado + 0.001 >= valor;
  const faltam = Math.max(valor - realizado, 0);
  const remaining = working.filter((iso) => iso >= todayISO && iso <= deadline);
  const cobrando = emAndamento && !atingida && remaining.length > 0;
  const restamMes = working.filter((iso) => iso >= todayISO);
  const faltamMes = Math.max((Number(totalMensal) || 0) - somaAte(todayISO), 0);
  const recalculandoMes =
    sameMonth && !cobrando && (vencido || atingida) && restamMes.length > 0;
  let metaDiaria = base;
  if (cobrando) metaDiaria = faltam / remaining.length;
  else if (recalculandoMes) metaDiaria = faltamMes / restamMes.length;
  const progresso = valor === 0 ? 0 : (realizado / valor) * 100;
  return {
    ativo: true,
    cobrando,
    em_andamento: emAndamento,
    vencido,
    atingida,
    dia: limite,
    valor: roundMoney(valor),
    data: deadline,
    realizado: roundMoney(realizado),
    faltam: roundMoney(faltam),
    progresso_pct: roundMoney(Math.min(progresso, 999)),
    dias_restantes: remaining.length,
    meta_diaria: roundMoney(metaDiaria),
    recalculando_mes: recalculandoMes,
  };
}

export function calcularMetas(userId: number, year: number, month: number) {
  const routine = getOrCreateRoutine(userId);
  const { goals: settings, isCustom } = getGoalsForMonth(userId, year, month);
  const gastosFixos = totalFixedExpenses(userId, year, month);

  const { start, end } = monthRange(year, month);
  const overrides = dbInstance.db.work_day_overrides.filter(
    (o) => o.user_id === userId && o.date >= start && o.date <= end
  );
  const overridesMap = new Map<string, boolean>();
  overrides.forEach((o) => overridesMap.set(o.date, o.working));

  const diasCalendario = getWorkingDates(year, month, routine.weekdays, overridesMap);
  const { include13th, vacationDaysYear, plannedRestDays } = camposProvisao(settings);
  const diasSemana = Math.max(routine.weekdays.length, 1);
  const provisao = montarProvisao(
    settings.monthly_net_profit,
    include13th,
    vacationDaysYear,
    diasSemana
  );
  const { dias, aplicadas: folgasAplicadas } = diasAposFolgas(
    diasCalendario.length,
    plannedRestDays
  );
  const horas = Math.max(routine.hours_per_day, 0.1);

  const total =
    gastosFixos +
    settings.monthly_net_profit +
    settings.monthly_contingency +
    provisao.provisao_descanso;
  const metaDiariaBase = total / dias;
  const earnings = dbInstance.db.daily_earnings.filter(
    (e) => e.user_id === userId && e.date >= start && e.date <= end
  );
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const marco = montarMarco(
    year,
    month,
    Number(settings.checkpoint_amount) || 0,
    Number(settings.checkpoint_day) || 0,
    diasCalendario,
    earnings,
    todayISO,
    metaDiariaBase,
    total
  );
  const metaDiaria = marco.meta_diaria;
  const metaSemanal = metaDiaria * diasSemana;
  const metaHora = metaDiaria / horas;
  const custoFixoDiario = gastosFixos / dias;

  return {
    gastos_fixos_mensal: roundMoney(gastosFixos),
    lucro_liquido_alvo: roundMoney(settings.monthly_net_profit),
    reserva_imprevistos: roundMoney(settings.monthly_contingency),
    total_necessario: roundMoney(total),
    custo_fixo_diario: roundMoney(custoFixoDiario),
    dias_trabalhados_mes: dias,
    dias_por_semana: routine.weekdays.length,
    horas_por_dia: routine.hours_per_day,
    meta_bruta_mensal: roundMoney(total),
    meta_bruta_semanal: roundMoney(metaSemanal),
    meta_bruta_diaria: roundMoney(metaDiaria),
    meta_diaria_base: roundMoney(metaDiariaBase),
    meta_por_hora: roundMoney(metaHora),
    formula:
      "(Gastos Fixos + Lucro Líquido + Reserva + Provisão 13º/férias) / Dias trabalhados no mês",
    is_custom: isCustom,
    ano: year,
    mes: month,
    include_13th: include13th,
    vacation_days_year: vacationDaysYear,
    planned_rest_days: plannedRestDays,
    dias_calendario: diasCalendario.length,
    folgas_aplicadas: folgasAplicadas,
    dias_uteis_ano: provisao.dias_uteis_ano,
    provisao_13: provisao.provisao_13,
    provisao_ferias: provisao.provisao_ferias,
    provisao_descanso: provisao.provisao_descanso,
    checkpoint_amount: roundMoney(Number(settings.checkpoint_amount) || 0),
    checkpoint_day: Number(settings.checkpoint_day) || 0,
    marco,
  };
}

export function montarConsumoCombustivel(
  fuelRows: { amount: number; liters?: number | null }[],
  kmTotal: number
) {
  const litros = fuelRows.reduce((sum, item) => sum + (item.liters || 0), 0);
  const gasto = fuelRows.reduce((sum, item) => sum + (item.amount || 0), 0);
  const kmL = litros && kmTotal ? kmTotal / litros : null;
  const rsKm = kmTotal && gasto ? gasto / kmTotal : null;
  const precoLitro = litros ? gasto / litros : null;
  return {
    abastecimentos: fuelRows.length,
    litros: roundMoney(litros),
    gasto: roundMoney(gasto),
    km_per_liter: kmL !== null ? roundMoney(kmL) : null,
    rs_per_km: rsKm !== null ? roundMoney(rsKm) : null,
    price_per_liter: precoLitro !== null ? roundMoney(precoLitro) : null,
  };
}

export function enrichVariableExpense(all: VariableExpense[], item: VariableExpense) {
  let price: number | null = null;
  let kmSince: number | null = null;
  let kmL: number | null = null;
  let rsKm: number | null = null;
  const isFuel = (item.type || "").toLowerCase() === "combustivel";
  if (isFuel && item.liters) {
    price = item.amount / item.liters;
    const prev = all
      .filter(
        (row) =>
          (row.type || "").toLowerCase() === "combustivel" &&
          row.odometer_km != null &&
          row.id !== item.id &&
          (row.date < item.date || (row.date === item.date && row.id < item.id))
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
    if (item.odometer_km != null && prev?.odometer_km != null) {
      const delta = Number(item.odometer_km) - Number(prev.odometer_km);
      if (delta > 0) {
        kmSince = delta;
        kmL = delta / item.liters;
        rsKm = item.amount / delta;
      }
    }
  }
  return {
    ...item,
    description: item.description || "",
    price_per_liter: price !== null ? roundMoney(price) : null,
    km_since_last: kmSince !== null ? roundMoney(kmSince) : null,
    km_per_liter: kmL !== null ? roundMoney(kmL) : null,
    rs_per_km: rsKm !== null ? roundMoney(rsKm) : null,
  };
}

export function montarEficiencia(
  faturamento: number,
  kmTotal: number,
  horasTotal: number,
  faturamentoComHoras: number,
  metaPorHora: number
) {
  const rsKm = kmTotal ? faturamento / kmTotal : null;
  const rsHora = horasTotal ? faturamentoComHoras / horasTotal : null;
  const comparacao =
    rsHora !== null && metaPorHora ? (rsHora / metaPorHora) * 100 : null;
  let badge: "excelente" | "media" | "abaixo" | null = null;
  if (comparacao !== null) {
    if (comparacao >= 110) badge = "excelente";
    else if (comparacao >= 85) badge = "media";
    else badge = "abaixo";
  }
  return {
    rs_por_km: rsKm !== null ? roundMoney(rsKm) : null,
    rs_por_hora: rsHora !== null ? roundMoney(rsHora) : null,
    horas_total: roundMoney(horasTotal),
    meta_por_hora: roundMoney(metaPorHora),
    comparacao_hora_pct: comparacao !== null ? roundMoney(comparacao) : null,
    badge,
  };
}

export function progressoDoDia(ganho: number, metaDiaria: number) {
  const meta = Math.max(metaDiaria, 0);
  const faltam = Math.max(meta - ganho, 0);
  const pct = meta === 0 && ganho > 0 ? 100.0 : meta === 0 ? 0.0 : (ganho / meta) * 100;
  return {
    meta_diaria: roundMoney(meta),
    atingida: ganho >= meta && meta > 0,
    faltam: roundMoney(faltam),
    progresso_pct: roundMoney(Math.min(pct, 999)),
  };
}

export function montarDashboard(userId: number, year: number, month: number) {
  const metas = calcularMetas(userId, year, month);
  const { start, end } = monthRange(year, month);
  const { db } = dbInstance;

  const earnings = db.daily_earnings.filter(
    (e) => e.user_id === userId && e.date >= start && e.date <= end
  );
  const variables = db.variable_expenses.filter(
    (v) => v.user_id === userId && v.date >= start && v.date <= end
  );

  const expenses = db.fixed_expenses.filter((e) => e.user_id === userId);
  const monthExpenses = expenses.filter((e) => {
    if (!e.due_date) return true;
    const [y, m] = e.due_date.split("-").map(Number);
    return y === year && m === month;
  });

  const payments = db.fixed_expense_payments.filter(
    (p) => p.user_id === userId && p.year === year && p.month === month
  );
  const paidMap = new Map<number, boolean>();
  payments.forEach((p) => paidMap.set(p.expense_id, p.paid));

  const faturamento = earnings.reduce((sum, e) => sum + e.gross_amount, 0);
  const kmTotal = earnings.reduce((sum, e) => sum + e.km_driven, 0);
  const horasTotal = earnings.reduce((sum, e) => sum + (e.hours_worked || 0), 0);
  const faturamentoComHoras = earnings.reduce(
    (sum, e) => sum + (e.hours_worked ? e.gross_amount : 0),
    0
  );
  const gastosVariaveis = variables.reduce((sum, v) => sum + v.amount, 0);

  let contasPagas = 0;
  let contasPendentes = 0;
  let valorPago = 0;
  let valorPendente = 0;

  for (const exp of monthExpenses) {
    if (paidMap.get(exp.id)) {
      contasPagas++;
      valorPago += exp.amount;
    } else {
      contasPendentes++;
      valorPendente += exp.amount;
    }
  }

  const gastosTotais = valorPago + gastosVariaveis;
  const lucroLiquido = faturamento - gastosTotais;
  const metaMensal = metas.meta_bruta_mensal;
  const metaPct = metaMensal === 0 ? 0.0 : (faturamento / metaMensal) * 100;
  const pagamentosPct =
    monthExpenses.length === 0 ? 0.0 : (contasPagas / monthExpenses.length) * 100;

  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  const todayEarning = earnings.find((e) => e.date === todayISO) || null;
  const ganhoHoje = todayEarning ? todayEarning.gross_amount : 0.0;
  const kmHoje = todayEarning ? todayEarning.km_driven : 0.0;
  const horasHoje = todayEarning ? todayEarning.hours_worked ?? null : null;
  const obsHoje = todayEarning ? todayEarning.notes || "" : "";
  const hojeStatus = progressoDoDia(ganhoHoje, metas.meta_bruta_diaria);
  const eficiencia = montarEficiencia(
    faturamento,
    kmTotal,
    horasTotal,
    faturamentoComHoras,
    metas.meta_por_hora
  );
  const horasHojeNum = horasHoje || 0;
  const eficienciaHoje = montarEficiencia(
    ganhoHoje,
    kmHoje,
    horasHojeNum,
    horasHoje ? ganhoHoje : 0,
    metas.meta_por_hora
  );

  return {
    periodo: { ano: year, mes: month },
    metas,
    realizado: {
      faturamento_uber: roundMoney(faturamento),
      gastos_fixos_pagos: roundMoney(valorPago),
      gastos_fixos_pendentes: roundMoney(valorPendente),
      gastos_variaveis: roundMoney(gastosVariaveis),
      gastos_totais: roundMoney(gastosTotais),
      lucro_liquido: roundMoney(lucroLiquido),
      km_total: roundMoney(kmTotal),
      horas_total: roundMoney(horasTotal),
      dias_com_ganho: earnings.length,
    },
    eficiencia,
    combustivel: montarConsumoCombustivel(
      variables.filter((v) => (v.type || "").toLowerCase() === "combustivel"),
      kmTotal
    ),
    progresso: {
      meta_mensal_pct: roundMoney(metaPct),
      pagamentos_pct: roundMoney(pagamentosPct),
      contas_pagas: contasPagas,
      contas_pendentes: contasPendentes,
      valor_pago: roundMoney(valorPago),
      valor_pendente: roundMoney(valorPendente),
    },
    hoje: {
      data: todayISO,
      ganho: roundMoney(ganhoHoje),
      km: roundMoney(kmHoje),
      horas: horasHoje,
      notes: obsHoje,
      tem_lancamento: todayEarning !== null,
      eficiencia: eficienciaHoje,
      ...hojeStatus,
    },
  };
}

export function montarHistorico(userId: number, year: number, month: number) {
  const { start, end } = monthRange(year, month);
  const dates = getDatesInMonth(year, month);
  const { db } = dbInstance;

  const daysMap = new Map<string, any>();
  for (const d of dates) {
    daysMap.set(d, {
      date: d,
      ganhos: 0.0,
      gastos: 0.0,
      km: 0.0,
      lucro: 0.0,
      tem_ganho: false,
      tem_gasto: false,
      lancamentos: [] as any[],
    });
  }

  const earnings = db.daily_earnings
    .filter((e) => e.user_id === userId && e.date >= start && e.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));

  const variables = db.variable_expenses
    .filter((v) => v.user_id === userId && v.date >= start && v.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));

  const expenses = db.fixed_expenses.filter((e) => e.user_id === userId);

  for (const earning of earnings) {
    const day = daysMap.get(earning.date);
    if (day) {
      day.ganhos += earning.gross_amount;
      day.km += earning.km_driven;
      day.tem_ganho = true;
      day.lancamentos.push({
        kind: "ganho",
        title: earning.notes || "Ganho do dia",
        amount: roundMoney(earning.gross_amount),
      });
    }
  }

  for (const item of variables) {
    const day = daysMap.get(item.date);
    if (day) {
      day.gastos += item.amount;
      day.tem_gasto = true;
      day.lancamentos.push({
        kind: "gasto",
        title: item.description || item.type,
        amount: roundMoney(item.amount),
      });
    }
  }

  for (const exp of expenses) {
    if (!exp.due_date) continue;
    const day = daysMap.get(exp.due_date);
    if (day) {
      day.gastos += exp.amount;
      day.tem_gasto = true;
      day.lancamentos.push({
        kind: "gasto",
        title: exp.name,
        amount: roundMoney(exp.amount),
      });
    }
  }

  const dias = Array.from(daysMap.values()).map((day) => ({
    ...day,
    ganhos: roundMoney(day.ganhos),
    gastos: roundMoney(day.gastos),
    km: roundMoney(day.km),
    lucro: roundMoney(day.ganhos - day.gastos),
  }));

  return {
    periodo: { ano: year, mes: month },
    dias,
  };
}
