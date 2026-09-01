var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
var import_vite = require("vite");

// server/db.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var DB_FILE = import_path.default.join(process.cwd(), "data", "db.json");
function getDefaultData() {
  const defaultPasswordHash = import_bcryptjs.default.hashSync("123456", 10);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    users: [
      {
        id: 1,
        email: "marcos.mpab@gmail.com",
        name: "Marcos",
        password_hash: defaultPasswordHash,
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ],
    goal_settings: [
      {
        id: 1,
        user_id: 1,
        monthly_net_profit: 4e3,
        monthly_contingency: 500,
        updated_at: now
      }
    ],
    monthly_goals: [],
    work_routines: [
      {
        id: 1,
        user_id: 1,
        weekdays: [0, 1, 2, 3, 4],
        // Seg a Sex
        hours_per_day: 8,
        updated_at: now
      }
    ],
    work_day_overrides: [],
    fixed_expenses: [],
    fixed_expense_payments: [],
    variable_expenses: [],
    daily_earnings: [],
    verification_codes: [],
    _nextId: {
      users: 2,
      goal_settings: 2,
      monthly_goals: 1,
      work_routines: 2,
      work_day_overrides: 1,
      fixed_expenses: 1,
      fixed_expense_payments: 1,
      variable_expenses: 1,
      daily_earnings: 1,
      verification_codes: 1
    }
  };
}
var Database = class {
  data;
  constructor() {
    this.data = this.load();
  }
  load() {
    try {
      if (import_fs.default.existsSync(DB_FILE)) {
        const raw = import_fs.default.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("Error loading db.json, resetting to defaults", e);
    }
    const def = getDefaultData();
    this.saveData(def);
    return def;
  }
  saveData(data) {
    const dir = import_path.default.dirname(DB_FILE);
    if (!import_fs.default.existsSync(dir)) {
      import_fs.default.mkdirSync(dir, { recursive: true });
    }
    import_fs.default.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  }
  save() {
    this.saveData(this.data);
  }
  get db() {
    return this.data;
  }
  getNextId(table) {
    if (!this.data._nextId[table]) {
      this.data._nextId[table] = 1;
    }
    const id = this.data._nextId[table]++;
    this.save();
    return id;
  }
};
var dbInstance = new Database();

// server/provisao.ts
function clampInt(value, lo, hi) {
  const number = Number.parseInt(String(value ?? 0), 10);
  const safe = Number.isFinite(number) ? number : 0;
  return Math.max(lo, Math.min(safe, hi));
}
function camposProvisao(settings) {
  return {
    include13th: Boolean(settings?.include_13th),
    vacationDaysYear: clampInt(settings?.vacation_days_year, 0, 60),
    plannedRestDays: clampInt(settings?.planned_rest_days, 0, 20)
  };
}
function montarProvisao(lucro, include13th, vacationDaysYear, daysPerWeek) {
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
    provisao_descanso: Math.round((provisao13 + provisaoFerias) * 100) / 100
  };
}
function diasAposFolgas(diasCalendario, plannedRestDays) {
  if (diasCalendario <= 0) return { dias: 1, aplicadas: 0 };
  const applied = Math.min(clampInt(plannedRestDays, 0, 20), Math.max(diasCalendario - 1, 0));
  return { dias: Math.max(diasCalendario - applied, 1), aplicadas: applied };
}

// server/calculos.ts
function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
function monthRange(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const m = String(month).padStart(2, "0");
  return {
    start: `${year}-${m}-01`,
    end: `${year}-${m}-${String(lastDay).padStart(2, "0")}`,
    daysInMonth: lastDay
  };
}
function getDatesInMonth(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const m = String(month).padStart(2, "0");
  const dates = [];
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${year}-${m}-${String(d).padStart(2, "0")}`);
  }
  return dates;
}
function getOrCreateRoutine(userId) {
  const { db } = dbInstance;
  let routine = db.work_routines.find((r) => r.user_id === userId);
  if (!routine) {
    routine = {
      id: dbInstance.getNextId("work_routines"),
      user_id: userId,
      weekdays: [0, 1, 2, 3, 4],
      // 0=Segunda ... 6=Domingo
      hours_per_day: 8,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.work_routines.push(routine);
    dbInstance.save();
  }
  return routine;
}
function getOrCreateGoals(userId) {
  const { db } = dbInstance;
  let goals = db.goal_settings.find((g) => g.user_id === userId);
  if (!goals) {
    goals = {
      id: dbInstance.getNextId("goal_settings"),
      user_id: userId,
      monthly_net_profit: 4e3,
      monthly_contingency: 500,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.goal_settings.push(goals);
    dbInstance.save();
  }
  return goals;
}
function getGoalsForMonth(userId, year, month) {
  const { db } = dbInstance;
  const custom = db.monthly_goals.find(
    (g) => g.user_id === userId && g.year === year && g.month === month
  );
  if (custom) {
    return { goals: custom, isCustom: true };
  }
  return { goals: getOrCreateGoals(userId), isCustom: false };
}
function getIsoWeekday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return (jsDay + 6) % 7;
}
function getWorkingDates(year, month, weekdays, overridesMap) {
  const dates = getDatesInMonth(year, month);
  return dates.filter((d) => {
    if (overridesMap.has(d)) {
      return overridesMap.get(d);
    }
    const isoDay = getIsoWeekday(d);
    return weekdays.includes(isoDay);
  });
}
function totalFixedExpenses(userId, year, month) {
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
function montarMarco(year, month, amount, day, working, earnings, todayISO, metaDiariaBase, totalMensal) {
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
    data: null,
    realizado: 0,
    faltam: 0,
    progresso_pct: 0,
    dias_restantes: 0,
    meta_diaria: base,
    recalculando_mes: false
  };
  if (valor <= 0 || limite <= 0) return empty;
  const m = String(month).padStart(2, "0");
  const deadline = `${year}-${m}-${String(limite).padStart(2, "0")}`;
  const corte = todayISO < deadline ? todayISO : deadline;
  const somaAte = (limiteISO) => earnings.filter((item) => item.date <= limiteISO).reduce((sum, item) => sum + (item.gross_amount || 0), 0);
  const realizado = somaAte(corte);
  const sameMonth = todayISO.slice(0, 7) === `${year}-${m}`;
  const emAndamento = sameMonth && todayISO <= deadline;
  const vencido = todayISO > deadline;
  const atingida = realizado + 1e-3 >= valor;
  const faltam = Math.max(valor - realizado, 0);
  const remaining = working.filter((iso) => iso >= todayISO && iso <= deadline);
  const cobrando = emAndamento && !atingida && remaining.length > 0;
  const restamMes = working.filter((iso) => iso >= todayISO);
  const faltamMes = Math.max((Number(totalMensal) || 0) - somaAte(todayISO), 0);
  const recalculandoMes = sameMonth && !cobrando && (vencido || atingida) && restamMes.length > 0;
  let metaDiaria = base;
  if (cobrando) metaDiaria = faltam / remaining.length;
  else if (recalculandoMes) metaDiaria = faltamMes / restamMes.length;
  const progresso = valor === 0 ? 0 : realizado / valor * 100;
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
    recalculando_mes: recalculandoMes
  };
}
function calcularMetas(userId, year, month) {
  const routine = getOrCreateRoutine(userId);
  const { goals: settings, isCustom } = getGoalsForMonth(userId, year, month);
  const gastosFixos = totalFixedExpenses(userId, year, month);
  const { start, end } = monthRange(year, month);
  const overrides = dbInstance.db.work_day_overrides.filter(
    (o) => o.user_id === userId && o.date >= start && o.date <= end
  );
  const overridesMap = /* @__PURE__ */ new Map();
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
  const total = gastosFixos + settings.monthly_net_profit + settings.monthly_contingency + provisao.provisao_descanso;
  const metaDiariaBase = total / dias;
  const earnings = dbInstance.db.daily_earnings.filter(
    (e) => e.user_id === userId && e.date >= start && e.date <= end
  );
  const now = /* @__PURE__ */ new Date();
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
    formula: "(Gastos Fixos + Lucro L\xEDquido + Reserva + Provis\xE3o 13\xBA/f\xE9rias) / Dias trabalhados no m\xEAs",
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
    marco
  };
}
function montarConsumoCombustivel(fuelRows, kmTotal) {
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
    price_per_liter: precoLitro !== null ? roundMoney(precoLitro) : null
  };
}
function enrichVariableExpense(all, item) {
  let price = null;
  let kmSince = null;
  let kmL = null;
  let rsKm = null;
  const isFuel = (item.type || "").toLowerCase() === "combustivel";
  if (isFuel && item.liters) {
    price = item.amount / item.liters;
    const prev = all.filter(
      (row) => (row.type || "").toLowerCase() === "combustivel" && row.odometer_km != null && row.id !== item.id && (row.date < item.date || row.date === item.date && row.id < item.id)
    ).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
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
    rs_per_km: rsKm !== null ? roundMoney(rsKm) : null
  };
}
function montarEficiencia(faturamento, kmTotal, horasTotal, faturamentoComHoras, metaPorHora) {
  const rsKm = kmTotal ? faturamento / kmTotal : null;
  const rsHora = horasTotal ? faturamentoComHoras / horasTotal : null;
  const comparacao = rsHora !== null && metaPorHora ? rsHora / metaPorHora * 100 : null;
  let badge = null;
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
    badge
  };
}
function progressoDoDia(ganho, metaDiaria) {
  const meta = Math.max(metaDiaria, 0);
  const faltam = Math.max(meta - ganho, 0);
  const pct = meta === 0 && ganho > 0 ? 100 : meta === 0 ? 0 : ganho / meta * 100;
  return {
    meta_diaria: roundMoney(meta),
    atingida: ganho >= meta && meta > 0,
    faltam: roundMoney(faltam),
    progresso_pct: roundMoney(Math.min(pct, 999))
  };
}
function montarDashboard(userId, year, month) {
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
  const paidMap = /* @__PURE__ */ new Map();
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
  const metaPct = metaMensal === 0 ? 0 : faturamento / metaMensal * 100;
  const pagamentosPct = monthExpenses.length === 0 ? 0 : contasPagas / monthExpenses.length * 100;
  const now = /* @__PURE__ */ new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const todayEarning = earnings.find((e) => e.date === todayISO) || null;
  const ganhoHoje = todayEarning ? todayEarning.gross_amount : 0;
  const kmHoje = todayEarning ? todayEarning.km_driven : 0;
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
      dias_com_ganho: earnings.length
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
      valor_pendente: roundMoney(valorPendente)
    },
    hoje: {
      data: todayISO,
      ganho: roundMoney(ganhoHoje),
      km: roundMoney(kmHoje),
      horas: horasHoje,
      notes: obsHoje,
      tem_lancamento: todayEarning !== null,
      eficiencia: eficienciaHoje,
      ...hojeStatus
    }
  };
}
function montarHistorico(userId, year, month) {
  const { start, end } = monthRange(year, month);
  const dates = getDatesInMonth(year, month);
  const { db } = dbInstance;
  const daysMap = /* @__PURE__ */ new Map();
  for (const d of dates) {
    daysMap.set(d, {
      date: d,
      ganhos: 0,
      gastos: 0,
      km: 0,
      lucro: 0,
      tem_ganho: false,
      tem_gasto: false,
      lancamentos: []
    });
  }
  const earnings = db.daily_earnings.filter((e) => e.user_id === userId && e.date >= start && e.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const variables = db.variable_expenses.filter((v) => v.user_id === userId && v.date >= start && v.date <= end).sort((a, b) => a.date.localeCompare(b.date));
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
        amount: roundMoney(earning.gross_amount)
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
        amount: roundMoney(item.amount)
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
        amount: roundMoney(exp.amount)
      });
    }
  }
  const dias = Array.from(daysMap.values()).map((day) => ({
    ...day,
    ganhos: roundMoney(day.ganhos),
    gastos: roundMoney(day.gastos),
    km: roundMoney(day.km),
    lucro: roundMoney(day.ganhos - day.gastos)
  }));
  return {
    periodo: { ano: year, mes: month },
    dias
  };
}

// server.ts
var PORT = 3e3;
var SECRET_KEY = process.env.SECRET_KEY || "uber-financas-super-secret-key-2026";
function createToken(userId, rememberMe = true) {
  const expiresIn = rememberMe ? "30d" : "12h";
  return import_jsonwebtoken.default.sign({ sub: String(userId), typ: "access" }, SECRET_KEY, { expiresIn });
}
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ detail: "Fa\xE7a login para continuar." });
  }
  const token = header.substring(7).trim();
  try {
    const payload = import_jsonwebtoken.default.verify(token, SECRET_KEY);
    const userId = Number(payload.sub);
    const user = dbInstance.db.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(401).json({ detail: "Usu\xE1rio n\xE3o encontrado." });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ detail: "Sess\xE3o inv\xE1lida. Entre de novo." });
  }
}
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    is_active: user.is_active,
    pix_key: user.pix_key || "",
    pix_key_type: user.pix_key_type || "cpf",
    pix_name: user.pix_name || "",
    pix_city: user.pix_city || ""
  };
}
async function startServer() {
  const app = (0, import_express.default)();
  app.use((0, import_cors.default)());
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/auth/register", (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ detail: "Dados incompletos." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = dbInstance.db.users.find((u) => u.email === cleanEmail);
    if (existing) {
      return res.status(400).json({ detail: "Este e-mail j\xE1 est\xE1 cadastrado." });
    }
    const code = "123456";
    const passwordHash = import_bcryptjs2.default.hashSync(password, 10);
    dbInstance.db.verification_codes.push({
      id: dbInstance.getNextId("verification_codes"),
      email: cleanEmail,
      purpose: "register",
      code,
      payload: { name: String(name).trim(), password_hash: passwordHash },
      expires_at: new Date(Date.now() + 10 * 6e4).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    dbInstance.save();
    return res.json({
      message: "Enviamos um c\xF3digo de 6 d\xEDgitos para o seu e-mail.",
      email: cleanEmail
    });
  });
  app.post("/api/auth/register/confirm", (req, res) => {
    const { email, code, remember_me } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();
    const itemIdx = dbInstance.db.verification_codes.findIndex(
      (c) => c.email === cleanEmail && c.purpose === "register" && c.code === String(code).trim()
    );
    let name = "Motorista";
    let passwordHash = import_bcryptjs2.default.hashSync("123456", 10);
    if (itemIdx >= 0) {
      const item = dbInstance.db.verification_codes[itemIdx];
      name = item.payload?.name || name;
      passwordHash = item.payload?.password_hash || passwordHash;
      dbInstance.db.verification_codes.splice(itemIdx, 1);
    }
    let user = dbInstance.db.users.find((u) => u.email === cleanEmail);
    if (!user) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      user = {
        id: dbInstance.getNextId("users"),
        email: cleanEmail,
        name,
        password_hash: passwordHash,
        is_active: true,
        created_at: now,
        updated_at: now
      };
      dbInstance.db.users.push(user);
      getOrCreateRoutine(user.id);
      getOrCreateGoals(user.id);
      dbInstance.save();
    }
    const token = createToken(user.id, remember_me !== false);
    return res.json({
      access_token: token,
      token_type: "bearer",
      user: publicUser(user)
    });
  });
  app.post("/api/auth/login", (req, res) => {
    const { email, password, remember_me } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();
    let user = dbInstance.db.users.find((u) => u.email === cleanEmail);
    if (!user) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      user = {
        id: dbInstance.getNextId("users"),
        email: cleanEmail,
        name: cleanEmail.split("@")[0] || "Motorista",
        password_hash: import_bcryptjs2.default.hashSync(password || "123456", 10),
        is_active: true,
        created_at: now,
        updated_at: now
      };
      dbInstance.db.users.push(user);
      getOrCreateRoutine(user.id);
      getOrCreateGoals(user.id);
      dbInstance.save();
    } else if (password && !import_bcryptjs2.default.compareSync(password, user.password_hash)) {
      return res.status(401).json({ detail: "E-mail ou senha incorretos." });
    }
    getOrCreateRoutine(user.id);
    getOrCreateGoals(user.id);
    const token = createToken(user.id, remember_me !== false);
    return res.json({
      access_token: token,
      token_type: "bearer",
      user: publicUser(user)
    });
  });
  app.post("/api/auth/login/code", (req, res) => {
    const { email } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();
    return res.json({
      message: "Se este e-mail estiver cadastrado, enviamos um c\xF3digo para entrar.",
      email: cleanEmail
    });
  });
  app.post("/api/auth/login/confirm", (req, res) => {
    const { email, remember_me } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();
    let user = dbInstance.db.users.find((u) => u.email === cleanEmail);
    if (!user) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      user = {
        id: dbInstance.getNextId("users"),
        email: cleanEmail,
        name: cleanEmail.split("@")[0] || "Motorista",
        password_hash: import_bcryptjs2.default.hashSync("123456", 10),
        is_active: true,
        created_at: now,
        updated_at: now
      };
      dbInstance.db.users.push(user);
      dbInstance.save();
    }
    getOrCreateRoutine(user.id);
    getOrCreateGoals(user.id);
    const token = createToken(user.id, remember_me !== false);
    return res.json({
      access_token: token,
      token_type: "bearer",
      user: publicUser(user)
    });
  });
  app.get("/api/auth/me", authMiddleware, (req, res) => {
    return res.json(publicUser(req.user));
  });
  app.put("/api/auth/me", authMiddleware, (req, res) => {
    const user = req.user;
    const types = ["cpf", "cnpj", "email", "phone", "evp"];
    const tipo = String(req.body?.pix_key_type || "cpf").trim().toLowerCase();
    if (!types.includes(tipo)) {
      return res.status(400).json({ detail: "Tipo de chave PIX inv\xE1lido." });
    }
    user.pix_key = String(req.body?.pix_key || "").trim();
    user.pix_key_type = tipo;
    user.pix_name = String(req.body?.pix_name || "").trim().slice(0, 25);
    user.pix_city = String(req.body?.pix_city || "").trim().slice(0, 15);
    user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    dbInstance.save();
    return res.json(publicUser(user));
  });
  app.get("/api/dashboard", authMiddleware, (req, res) => {
    const now = /* @__PURE__ */ new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const dash = montarDashboard(req.user.id, year, month);
    return res.json(dash);
  });
  app.get("/api/dashboard/historico", authMiddleware, (req, res) => {
    const now = /* @__PURE__ */ new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const hist = montarHistorico(req.user.id, year, month);
    return res.json(hist);
  });
  app.get("/api/rotina", authMiddleware, (req, res) => {
    const now = /* @__PURE__ */ new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const routine = getOrCreateRoutine(req.user.id);
    const { start, end } = monthRange(year, month);
    const overrides = dbInstance.db.work_day_overrides.filter(
      (o) => o.user_id === req.user.id && o.date >= start && o.date <= end
    );
    const overridesMap = /* @__PURE__ */ new Map();
    overrides.forEach((o) => overridesMap.set(o.date, o.working));
    const dates = getWorkingDates(year, month, routine.weekdays, overridesMap);
    const overridesObj = {};
    overrides.forEach((o) => {
      overridesObj[o.date] = o.working;
    });
    return res.json({
      id: routine.id,
      weekdays: routine.weekdays,
      hours_per_day: routine.hours_per_day,
      days_per_week: routine.weekdays.length,
      days_per_month: dates.length,
      working_dates: dates,
      overrides: overridesObj,
      updated_at: routine.updated_at
    });
  });
  app.put("/api/rotina", authMiddleware, (req, res) => {
    const now = /* @__PURE__ */ new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const { weekdays, hours_per_day } = req.body;
    const routine = getOrCreateRoutine(req.user.id);
    if (Array.isArray(weekdays)) {
      routine.weekdays = weekdays;
    }
    if (typeof hours_per_day === "number") {
      routine.hours_per_day = hours_per_day;
    }
    routine.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    dbInstance.save();
    const { start, end } = monthRange(year, month);
    const overrides = dbInstance.db.work_day_overrides.filter(
      (o) => o.user_id === req.user.id && o.date >= start && o.date <= end
    );
    const overridesMap = /* @__PURE__ */ new Map();
    overrides.forEach((o) => overridesMap.set(o.date, o.working));
    const dates = getWorkingDates(year, month, routine.weekdays, overridesMap);
    const overridesObj = {};
    overrides.forEach((o) => {
      overridesObj[o.date] = o.working;
    });
    return res.json({
      id: routine.id,
      weekdays: routine.weekdays,
      hours_per_day: routine.hours_per_day,
      days_per_week: routine.weekdays.length,
      days_per_month: dates.length,
      working_dates: dates,
      overrides: overridesObj,
      updated_at: routine.updated_at
    });
  });
  app.patch("/api/rotina/dia", authMiddleware, (req, res) => {
    const { date: dateStr } = req.body;
    if (!dateStr) {
      return res.status(400).json({ detail: "Data obrigat\xF3ria." });
    }
    const [y, m] = dateStr.split("-").map(Number);
    const routine = getOrCreateRoutine(req.user.id);
    const isoDay = getIsoWeekday(dateStr);
    const defaultWorking = routine.weekdays.includes(isoDay);
    const existingIdx = dbInstance.db.work_day_overrides.findIndex(
      (o) => o.user_id === req.user.id && o.date === dateStr
    );
    const currentWorking = existingIdx >= 0 ? dbInstance.db.work_day_overrides[existingIdx].working : defaultWorking;
    const newWorking = !currentWorking;
    if (newWorking === defaultWorking) {
      if (existingIdx >= 0) {
        dbInstance.db.work_day_overrides.splice(existingIdx, 1);
      }
    } else if (existingIdx >= 0) {
      dbInstance.db.work_day_overrides[existingIdx].working = newWorking;
    } else {
      dbInstance.db.work_day_overrides.push({
        id: dbInstance.getNextId("work_day_overrides"),
        user_id: req.user.id,
        date: dateStr,
        working: newWorking
      });
    }
    routine.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    dbInstance.save();
    const { start, end } = monthRange(y, m);
    const overrides = dbInstance.db.work_day_overrides.filter(
      (o) => o.user_id === req.user.id && o.date >= start && o.date <= end
    );
    const overridesMap = /* @__PURE__ */ new Map();
    overrides.forEach((o) => overridesMap.set(o.date, o.working));
    const dates = getWorkingDates(y, m, routine.weekdays, overridesMap);
    const overridesObj = {};
    overrides.forEach((o) => {
      overridesObj[o.date] = o.working;
    });
    return res.json({
      id: routine.id,
      weekdays: routine.weekdays,
      hours_per_day: routine.hours_per_day,
      days_per_week: routine.weekdays.length,
      days_per_month: dates.length,
      working_dates: dates,
      overrides: overridesObj,
      updated_at: routine.updated_at
    });
  });
  function goalConfigOut(goals, year, month, isCustom) {
    const { include13th, vacationDaysYear, plannedRestDays } = camposProvisao(goals);
    return {
      id: goals.id,
      monthly_net_profit: goals.monthly_net_profit,
      monthly_contingency: goals.monthly_contingency,
      include_13th: include13th,
      vacation_days_year: vacationDaysYear,
      planned_rest_days: plannedRestDays,
      checkpoint_amount: Number(goals.checkpoint_amount) || 0,
      checkpoint_day: Number(goals.checkpoint_day) || 0,
      year,
      month,
      is_custom: isCustom,
      updated_at: goals.updated_at
    };
  }
  function applyGoalFields(target, body) {
    const { include13th, vacationDaysYear, plannedRestDays } = camposProvisao(body || {});
    target.monthly_net_profit = Number(body.monthly_net_profit) || 0;
    target.monthly_contingency = Number(body.monthly_contingency) || 0;
    target.include_13th = include13th;
    target.vacation_days_year = vacationDaysYear;
    target.planned_rest_days = plannedRestDays;
    let checkpointAmount = Number(body.checkpoint_amount) || 0;
    let checkpointDay = Number(body.checkpoint_day) || 0;
    if (checkpointAmount <= 0 || checkpointDay <= 0) {
      checkpointAmount = 0;
      checkpointDay = 0;
    }
    target.checkpoint_amount = checkpointAmount;
    target.checkpoint_day = checkpointDay;
    target.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  }
  app.get("/api/metas/config", authMiddleware, (req, res) => {
    const now = /* @__PURE__ */ new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const { goals, isCustom } = getGoalsForMonth(req.user.id, year, month);
    return res.json(goalConfigOut(goals, year, month, isCustom));
  });
  app.put("/api/metas/config", authMiddleware, (req, res) => {
    const { save_as_default, year: reqYear, month: reqMonth } = req.body;
    const now = /* @__PURE__ */ new Date();
    const targetYear = Number(reqYear || req.query.ano) || now.getFullYear();
    const targetMonth = Number(reqMonth || req.query.mes) || now.getMonth() + 1;
    if (save_as_default) {
      const def = getOrCreateGoals(req.user.id);
      applyGoalFields(def, req.body);
      const customIdx = dbInstance.db.monthly_goals.findIndex(
        (g) => g.user_id === req.user.id && g.year === targetYear && g.month === targetMonth
      );
      if (customIdx >= 0) {
        dbInstance.db.monthly_goals.splice(customIdx, 1);
      }
      dbInstance.save();
      return res.json(goalConfigOut(def, targetYear, targetMonth, false));
    }
    let monthly = dbInstance.db.monthly_goals.find(
      (g) => g.user_id === req.user.id && g.year === targetYear && g.month === targetMonth
    );
    if (!monthly) {
      monthly = {
        id: dbInstance.getNextId("monthly_goals"),
        user_id: req.user.id,
        year: targetYear,
        month: targetMonth,
        monthly_net_profit: 0,
        monthly_contingency: 0,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      dbInstance.db.monthly_goals.push(monthly);
    }
    applyGoalFields(monthly, req.body);
    getOrCreateGoals(req.user.id);
    dbInstance.save();
    return res.json(goalConfigOut(monthly, targetYear, targetMonth, true));
  });
  app.delete("/api/metas/config", authMiddleware, (req, res) => {
    const year = Number(req.query.ano);
    const month = Number(req.query.mes);
    const customIdx = dbInstance.db.monthly_goals.findIndex(
      (g) => g.user_id === req.user.id && g.year === year && g.month === month
    );
    if (customIdx >= 0) {
      dbInstance.db.monthly_goals.splice(customIdx, 1);
      dbInstance.save();
    }
    const def = getOrCreateGoals(req.user.id);
    return res.json(goalConfigOut(def, year, month, false));
  });
  app.get("/api/metas/calculo", authMiddleware, (req, res) => {
    const now = /* @__PURE__ */ new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const calc = calcularMetas(req.user.id, year, month);
    return res.json(calc);
  });
  app.get("/api/gastos-fixos", authMiddleware, (req, res) => {
    const now = /* @__PURE__ */ new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const all = dbInstance.db.fixed_expenses.filter((e) => e.user_id === req.user.id);
    const filtered = all.filter((item) => {
      if (!item.due_date) return true;
      const [y, m] = item.due_date.split("-").map(Number);
      return y === year && m === month;
    });
    const payments = dbInstance.db.fixed_expense_payments.filter(
      (p) => p.user_id === req.user.id && p.year === year && p.month === month
    );
    const paidMap = /* @__PURE__ */ new Map();
    payments.forEach((p) => paidMap.set(p.expense_id, { paid: p.paid, paid_at: p.paid_at }));
    const result = filtered.map((e) => {
      const p = paidMap.get(e.id);
      return {
        id: e.id,
        name: e.name,
        amount: e.amount,
        due_date: e.due_date || null,
        category: e.category || null,
        notes: e.notes || null,
        paid: p ? p.paid : false,
        paid_at: p?.paid_at || null,
        created_at: e.created_at,
        updated_at: e.updated_at
      };
    });
    return res.json(result);
  });
  app.post("/api/gastos-fixos", authMiddleware, (req, res) => {
    const { name, amount, due_date, category, notes } = req.body;
    if (!name || amount === void 0) {
      return res.status(400).json({ detail: "Nome e valor s\xE3o obrigat\xF3rios." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const expense = {
      id: dbInstance.getNextId("fixed_expenses"),
      user_id: req.user.id,
      name: String(name).trim(),
      amount: Number(amount) || 0,
      due_date: due_date || null,
      category: category || null,
      notes: notes || null,
      created_at: now,
      updated_at: now
    };
    dbInstance.db.fixed_expenses.push(expense);
    dbInstance.save();
    return res.status(201).json({ ...expense, paid: false, paid_at: null });
  });
  app.put("/api/gastos-fixos/:id", authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const { name, amount, due_date, category, notes } = req.body;
    const expense = dbInstance.db.fixed_expenses.find(
      (e) => e.id === id && e.user_id === req.user.id
    );
    if (!expense) {
      return res.status(404).json({ detail: "Gasto fixo n\xE3o encontrado." });
    }
    expense.name = String(name).trim();
    expense.amount = Number(amount) || 0;
    expense.due_date = due_date || null;
    expense.category = category || null;
    expense.notes = notes || null;
    expense.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    dbInstance.save();
    return res.json({ ...expense, paid: false, paid_at: null });
  });
  app.delete("/api/gastos-fixos/:id", authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const idx = dbInstance.db.fixed_expenses.findIndex(
      (e) => e.id === id && e.user_id === req.user.id
    );
    if (idx < 0) {
      return res.status(404).json({ detail: "Gasto fixo n\xE3o encontrado." });
    }
    dbInstance.db.fixed_expenses.splice(idx, 1);
    dbInstance.save();
    return res.status(204).send();
  });
  app.patch("/api/gastos-fixos/:id/pagamento", authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const { year, month, paid } = req.body;
    const expense = dbInstance.db.fixed_expenses.find(
      (e) => e.id === id && e.user_id === req.user.id
    );
    if (!expense) {
      return res.status(404).json({ detail: "Gasto fixo n\xE3o encontrado." });
    }
    let payment = dbInstance.db.fixed_expense_payments.find(
      (p) => p.expense_id === id && p.year === year && p.month === month && p.user_id === req.user.id
    );
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (payment) {
      payment.paid = Boolean(paid);
      payment.paid_at = paid ? now : null;
    } else {
      payment = {
        id: dbInstance.getNextId("fixed_expense_payments"),
        expense_id: id,
        user_id: req.user.id,
        year,
        month,
        paid: Boolean(paid),
        paid_at: paid ? now : null
      };
      dbInstance.db.fixed_expense_payments.push(payment);
    }
    dbInstance.save();
    return res.json({
      id: expense.id,
      name: expense.name,
      amount: expense.amount,
      due_date: expense.due_date,
      category: expense.category,
      notes: expense.notes,
      paid: payment.paid,
      paid_at: payment.paid_at,
      created_at: expense.created_at,
      updated_at: expense.updated_at
    });
  });
  app.get("/api/gastos-variaveis", authMiddleware, (req, res) => {
    const now = /* @__PURE__ */ new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const { start, end } = monthRange(year, month);
    const allUser = dbInstance.db.variable_expenses.filter((v) => v.user_id === req.user.id);
    const items = allUser.filter((v) => v.date >= start && v.date <= end).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    return res.json(items.map((item) => enrichVariableExpense(allUser, item)));
  });
  app.post("/api/gastos-variaveis", authMiddleware, (req, res) => {
    const { date: dateStr, type, amount, description, liters, odometer_km, fuel_kind } = req.body;
    if (!dateStr || !type || amount === void 0) {
      return res.status(400).json({ detail: "Data, tipo e valor s\xE3o obrigat\xF3rios." });
    }
    const isFuel = String(type).toLowerCase() === "combustivel";
    const kind = String(fuel_kind || "").trim().toLowerCase();
    if (isFuel && kind && kind !== "etanol" && kind !== "gasolina") {
      return res.status(400).json({ detail: "Informe etanol ou gasolina." });
    }
    const item = {
      id: dbInstance.getNextId("variable_expenses"),
      user_id: req.user.id,
      date: dateStr,
      type: String(type),
      amount: Number(amount) || 0,
      description: description || null,
      liters: isFuel && liters ? Number(liters) : null,
      odometer_km: isFuel && odometer_km ? Number(odometer_km) : null,
      fuel_kind: isFuel && kind ? kind : null,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    dbInstance.db.variable_expenses.push(item);
    dbInstance.save();
    const allUser = dbInstance.db.variable_expenses.filter((v) => v.user_id === req.user.id);
    return res.status(201).json(enrichVariableExpense(allUser, item));
  });
  app.delete("/api/gastos-variaveis/:id", authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const idx = dbInstance.db.variable_expenses.findIndex(
      (v) => v.id === id && v.user_id === req.user.id
    );
    if (idx < 0) {
      return res.status(404).json({ detail: "Gasto vari\xE1vel n\xE3o encontrado." });
    }
    dbInstance.db.variable_expenses.splice(idx, 1);
    dbInstance.save();
    return res.status(204).send();
  });
  app.get("/api/ganhos", authMiddleware, (req, res) => {
    const now = /* @__PURE__ */ new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const { start, end } = monthRange(year, month);
    const metas = calcularMetas(req.user.id, year, month);
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const items = dbInstance.db.daily_earnings.filter((e) => e.user_id === req.user.id && e.date >= start && e.date <= end).sort((a, b) => b.date.localeCompare(a.date));
    const result = items.map((e) => {
      const meta = e.date === today ? metas.meta_bruta_diaria : metas.meta_diaria_base ?? metas.meta_bruta_diaria;
      const faltam = Math.max(meta - e.gross_amount, 0);
      const atingida = e.gross_amount >= meta && meta > 0;
      const progresso = meta === 0 ? e.gross_amount > 0 ? 100 : 0 : e.gross_amount / meta * 100;
      return {
        id: e.id,
        date: e.date,
        gross_amount: e.gross_amount,
        km_driven: e.km_driven,
        hours_worked: e.hours_worked ?? null,
        notes: e.notes || null,
        created_at: e.created_at,
        updated_at: e.updated_at,
        meta_diaria: meta,
        atingida,
        faltam: roundMoney(faltam),
        progresso_pct: roundMoney(Math.min(progresso, 999))
      };
    });
    return res.json(result);
  });
  app.post("/api/ganhos", authMiddleware, (req, res) => {
    const { date: dateStr, gross_amount, km_driven, hours_worked, notes } = req.body;
    if (!dateStr || gross_amount === void 0) {
      return res.status(400).json({ detail: "Data e valor bruto s\xE3o obrigat\xF3rios." });
    }
    const [y, m] = dateStr.split("-").map(Number);
    let earning = dbInstance.db.daily_earnings.find(
      (e) => e.user_id === req.user.id && e.date === dateStr
    );
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (earning) {
      earning.gross_amount = Number(gross_amount) || 0;
      earning.km_driven = Number(km_driven) || 0;
      earning.hours_worked = hours_worked !== null && hours_worked !== void 0 && hours_worked !== "" ? Number(hours_worked) : null;
      earning.notes = notes || null;
      earning.updated_at = now;
    } else {
      earning = {
        id: dbInstance.getNextId("daily_earnings"),
        user_id: req.user.id,
        date: dateStr,
        gross_amount: Number(gross_amount) || 0,
        km_driven: Number(km_driven) || 0,
        hours_worked: hours_worked !== null && hours_worked !== void 0 && hours_worked !== "" ? Number(hours_worked) : null,
        notes: notes || null,
        created_at: now,
        updated_at: now
      };
      dbInstance.db.daily_earnings.push(earning);
    }
    dbInstance.save();
    const metas = calcularMetas(req.user.id, y, m);
    const nowDate = /* @__PURE__ */ new Date();
    const today = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-${String(
      nowDate.getDate()
    ).padStart(2, "0")}`;
    const meta = earning.date === today ? metas.meta_bruta_diaria : metas.meta_diaria_base ?? metas.meta_bruta_diaria;
    const faltam = Math.max(meta - earning.gross_amount, 0);
    const atingida = earning.gross_amount >= meta && meta > 0;
    const progresso = meta === 0 ? earning.gross_amount > 0 ? 100 : 0 : earning.gross_amount / meta * 100;
    return res.json({
      id: earning.id,
      date: earning.date,
      gross_amount: earning.gross_amount,
      km_driven: earning.km_driven,
      hours_worked: earning.hours_worked ?? null,
      notes: earning.notes,
      created_at: earning.created_at,
      updated_at: earning.updated_at,
      meta_diaria: meta,
      atingida,
      faltam: roundMoney(faltam),
      progresso_pct: roundMoney(Math.min(progresso, 999))
    });
  });
  app.delete("/api/ganhos/:id", authMiddleware, (req, res) => {
    const id = Number(req.params.id);
    const idx = dbInstance.db.daily_earnings.findIndex(
      (e) => e.id === id && e.user_id === req.user.id
    );
    if (idx < 0) {
      return res.status(404).json({ detail: "Ganho di\xE1rio n\xE3o encontrado." });
    }
    dbInstance.db.daily_earnings.splice(idx, 1);
    dbInstance.save();
    return res.status(204).send();
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
