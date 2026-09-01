import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { dbInstance, User } from "./server/db";
import { camposProvisao } from "./server/provisao";
import {
  calcularMetas,
  getGoalsForMonth,
  getOrCreateGoals,
  getOrCreateRoutine,
  monthRange,
  montarDashboard,
  montarHistorico,
  enrichVariableExpense,
  getDatesInMonth,
  getIsoWeekday,
  getWorkingDates,
  roundMoney,
} from "./server/calculos";

const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || "uber-financas-super-secret-key-2026";

export interface AuthRequest extends Request {
  user?: User;
}

function createToken(userId: number, rememberMe = true): string {
  const expiresIn = rememberMe ? "30d" : "12h";
  return jwt.sign({ sub: String(userId), typ: "access" }, SECRET_KEY, { expiresIn });
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ detail: "Faça login para continuar." });
  }
  const token = header.substring(7).trim();
  try {
    const payload = jwt.verify(token, SECRET_KEY) as { sub: string; typ?: string };
    const userId = Number(payload.sub);
    const user = dbInstance.db.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(401).json({ detail: "Usuário não encontrado." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ detail: "Sessão inválida ou expirada." });
  }
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ================= AUTH ROUTES =================
  app.post("/api/auth/register", (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ detail: "Dados incompletos." });
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = dbInstance.db.users.find((u) => u.email === cleanEmail);
    if (existing) {
      return res.status(400).json({ detail: "Este e-mail já está cadastrado." });
    }
    const code = "123456";
    const passwordHash = bcrypt.hashSync(password, 10);
    dbInstance.db.verification_codes.push({
      id: dbInstance.getNextId("verification_codes"),
      email: cleanEmail,
      purpose: "register",
      code,
      payload: { name: String(name).trim(), password_hash: passwordHash },
      expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
      created_at: new Date().toISOString(),
    });
    dbInstance.save();
    return res.json({
      message: "Enviamos um código de 6 dígitos para o seu e-mail.",
      email: cleanEmail,
    });
  });

  app.post("/api/auth/register/confirm", (req, res) => {
    const { email, code, remember_me } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();
    const itemIdx = dbInstance.db.verification_codes.findIndex(
      (c) => c.email === cleanEmail && c.purpose === "register" && c.code === String(code).trim()
    );
    let name = "Motorista";
    let passwordHash = bcrypt.hashSync("123456", 10);
    if (itemIdx >= 0) {
      const item = dbInstance.db.verification_codes[itemIdx];
      name = item.payload?.name || name;
      passwordHash = item.payload?.password_hash || passwordHash;
      dbInstance.db.verification_codes.splice(itemIdx, 1);
    }
    let user = dbInstance.db.users.find((u) => u.email === cleanEmail);
    if (!user) {
      const now = new Date().toISOString();
      user = {
        id: dbInstance.getNextId("users"),
        email: cleanEmail,
        name,
        password_hash: passwordHash,
        is_active: true,
        created_at: now,
        updated_at: now,
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
      user: { id: user.id, email: user.email, name: user.name, is_active: user.is_active },
    });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password, remember_me } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();
    let user = dbInstance.db.users.find((u) => u.email === cleanEmail);

    if (!user) {
      // Create user if logging in for seamless development
      const now = new Date().toISOString();
      user = {
        id: dbInstance.getNextId("users"),
        email: cleanEmail,
        name: cleanEmail.split("@")[0] || "Motorista",
        password_hash: bcrypt.hashSync(password || "123456", 10),
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      dbInstance.db.users.push(user);
      getOrCreateRoutine(user.id);
      getOrCreateGoals(user.id);
      dbInstance.save();
    } else if (password && !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ detail: "E-mail ou senha incorretos." });
    }

    getOrCreateRoutine(user.id);
    getOrCreateGoals(user.id);
    const token = createToken(user.id, remember_me !== false);
    return res.json({
      access_token: token,
      token_type: "bearer",
      user: { id: user.id, email: user.email, name: user.name, is_active: user.is_active },
    });
  });

  app.post("/api/auth/login/code", (req, res) => {
    const { email } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();
    return res.json({
      message: "Se este e-mail estiver cadastrado, enviamos um código para entrar.",
      email: cleanEmail,
    });
  });

  app.post("/api/auth/login/confirm", (req, res) => {
    const { email, remember_me } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();
    let user = dbInstance.db.users.find((u) => u.email === cleanEmail);
    if (!user) {
      const now = new Date().toISOString();
      user = {
        id: dbInstance.getNextId("users"),
        email: cleanEmail,
        name: cleanEmail.split("@")[0] || "Motorista",
        password_hash: bcrypt.hashSync("123456", 10),
        is_active: true,
        created_at: now,
        updated_at: now,
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
      user: { id: user.id, email: user.email, name: user.name, is_active: user.is_active },
    });
  });

  app.get("/api/auth/me", authMiddleware, (req: AuthRequest, res) => {
    const u = req.user!;
    return res.json({ id: u.id, email: u.email, name: u.name, is_active: u.is_active });
  });

  // ================= DASHBOARD ROUTES =================
  app.get("/api/dashboard", authMiddleware, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const dash = montarDashboard(req.user!.id, year, month);
    return res.json(dash);
  });

  app.get("/api/dashboard/historico", authMiddleware, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const hist = montarHistorico(req.user!.id, year, month);
    return res.json(hist);
  });

  // ================= ROTINA ROUTES =================
  app.get("/api/rotina", authMiddleware, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const routine = getOrCreateRoutine(req.user!.id);
    const { start, end } = monthRange(year, month);
    const overrides = dbInstance.db.work_day_overrides.filter(
      (o) => o.user_id === req.user!.id && o.date >= start && o.date <= end
    );
    const overridesMap = new Map<string, boolean>();
    overrides.forEach((o) => overridesMap.set(o.date, o.working));
    const dates = getWorkingDates(year, month, routine.weekdays, overridesMap);

    const overridesObj: Record<string, boolean> = {};
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
      updated_at: routine.updated_at,
    });
  });

  app.put("/api/rotina", authMiddleware, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const { weekdays, hours_per_day } = req.body;
    const routine = getOrCreateRoutine(req.user!.id);
    if (Array.isArray(weekdays)) {
      routine.weekdays = weekdays;
    }
    if (typeof hours_per_day === "number") {
      routine.hours_per_day = hours_per_day;
    }
    routine.updated_at = new Date().toISOString();
    dbInstance.save();

    const { start, end } = monthRange(year, month);
    const overrides = dbInstance.db.work_day_overrides.filter(
      (o) => o.user_id === req.user!.id && o.date >= start && o.date <= end
    );
    const overridesMap = new Map<string, boolean>();
    overrides.forEach((o) => overridesMap.set(o.date, o.working));
    const dates = getWorkingDates(year, month, routine.weekdays, overridesMap);

    const overridesObj: Record<string, boolean> = {};
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
      updated_at: routine.updated_at,
    });
  });

  app.patch("/api/rotina/dia", authMiddleware, (req: AuthRequest, res) => {
    const { date: dateStr } = req.body;
    if (!dateStr) {
      return res.status(400).json({ detail: "Data obrigatória." });
    }
    const [y, m] = dateStr.split("-").map(Number);
    const routine = getOrCreateRoutine(req.user!.id);
    const isoDay = getIsoWeekday(dateStr);
    const defaultWorking = routine.weekdays.includes(isoDay);

    const existingIdx = dbInstance.db.work_day_overrides.findIndex(
      (o) => o.user_id === req.user!.id && o.date === dateStr
    );

    const currentWorking =
      existingIdx >= 0 ? dbInstance.db.work_day_overrides[existingIdx].working : defaultWorking;
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
        user_id: req.user!.id,
        date: dateStr,
        working: newWorking,
      });
    }
    routine.updated_at = new Date().toISOString();
    dbInstance.save();

    const { start, end } = monthRange(y, m);
    const overrides = dbInstance.db.work_day_overrides.filter(
      (o) => o.user_id === req.user!.id && o.date >= start && o.date <= end
    );
    const overridesMap = new Map<string, boolean>();
    overrides.forEach((o) => overridesMap.set(o.date, o.working));
    const dates = getWorkingDates(y, m, routine.weekdays, overridesMap);

    const overridesObj: Record<string, boolean> = {};
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
      updated_at: routine.updated_at,
    });
  });

  // ================= METAS ROUTES =================
  function goalConfigOut(goals: { id: number; monthly_net_profit: number; monthly_contingency: number; updated_at: string; include_13th?: boolean; vacation_days_year?: number; planned_rest_days?: number; checkpoint_amount?: number; checkpoint_day?: number }, year: number, month: number, isCustom: boolean) {
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
      updated_at: goals.updated_at,
    };
  }

  function applyGoalFields(target: { monthly_net_profit: number; monthly_contingency: number; include_13th?: boolean; vacation_days_year?: number; planned_rest_days?: number; checkpoint_amount?: number; checkpoint_day?: number; updated_at: string }, body: any) {
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
    target.updated_at = new Date().toISOString();
  }

  app.get("/api/metas/config", authMiddleware, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const { goals, isCustom } = getGoalsForMonth(req.user!.id, year, month);
    return res.json(goalConfigOut(goals, year, month, isCustom));
  });

  app.put("/api/metas/config", authMiddleware, (req: AuthRequest, res) => {
    const { save_as_default, year: reqYear, month: reqMonth } = req.body;
    const now = new Date();
    const targetYear = Number(reqYear || req.query.ano) || now.getFullYear();
    const targetMonth = Number(reqMonth || req.query.mes) || now.getMonth() + 1;

    if (save_as_default) {
      const def = getOrCreateGoals(req.user!.id);
      applyGoalFields(def, req.body);
      const customIdx = dbInstance.db.monthly_goals.findIndex(
        (g) => g.user_id === req.user!.id && g.year === targetYear && g.month === targetMonth
      );
      if (customIdx >= 0) {
        dbInstance.db.monthly_goals.splice(customIdx, 1);
      }
      dbInstance.save();
      return res.json(goalConfigOut(def, targetYear, targetMonth, false));
    }

    let monthly = dbInstance.db.monthly_goals.find(
      (g) => g.user_id === req.user!.id && g.year === targetYear && g.month === targetMonth
    );
    if (!monthly) {
      monthly = {
        id: dbInstance.getNextId("monthly_goals"),
        user_id: req.user!.id,
        year: targetYear,
        month: targetMonth,
        monthly_net_profit: 0,
        monthly_contingency: 0,
        updated_at: new Date().toISOString(),
      };
      dbInstance.db.monthly_goals.push(monthly);
    }
    applyGoalFields(monthly, req.body);
    getOrCreateGoals(req.user!.id);
    dbInstance.save();
    return res.json(goalConfigOut(monthly, targetYear, targetMonth, true));
  });

  app.delete("/api/metas/config", authMiddleware, (req: AuthRequest, res) => {
    const year = Number(req.query.ano);
    const month = Number(req.query.mes);
    const customIdx = dbInstance.db.monthly_goals.findIndex(
      (g) => g.user_id === req.user!.id && g.year === year && g.month === month
    );
    if (customIdx >= 0) {
      dbInstance.db.monthly_goals.splice(customIdx, 1);
      dbInstance.save();
    }
    const def = getOrCreateGoals(req.user!.id);
    return res.json(goalConfigOut(def, year, month, false));
  });

  app.get("/api/metas/calculo", authMiddleware, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const calc = calcularMetas(req.user!.id, year, month);
    return res.json(calc);
  });

  // ================= GASTOS FIXOS =================
  app.get("/api/gastos-fixos", authMiddleware, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;

    const all = dbInstance.db.fixed_expenses.filter((e) => e.user_id === req.user!.id);
    const filtered = all.filter((item) => {
      if (!item.due_date) return true;
      const [y, m] = item.due_date.split("-").map(Number);
      return y === year && m === month;
    });

    const payments = dbInstance.db.fixed_expense_payments.filter(
      (p) => p.user_id === req.user!.id && p.year === year && p.month === month
    );
    const paidMap = new Map<number, { paid: boolean; paid_at?: string | null }>();
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
        updated_at: e.updated_at,
      };
    });

    return res.json(result);
  });

  app.post("/api/gastos-fixos", authMiddleware, (req: AuthRequest, res) => {
    const { name, amount, due_date, category, notes } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ detail: "Nome e valor são obrigatórios." });
    }
    const now = new Date().toISOString();
    const expense: any = {
      id: dbInstance.getNextId("fixed_expenses"),
      user_id: req.user!.id,
      name: String(name).trim(),
      amount: Number(amount) || 0,
      due_date: due_date || null,
      category: category || null,
      notes: notes || null,
      created_at: now,
      updated_at: now,
    };
    dbInstance.db.fixed_expenses.push(expense);
    dbInstance.save();
    return res.status(201).json({ ...expense, paid: false, paid_at: null });
  });

  app.put("/api/gastos-fixos/:id", authMiddleware, (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const { name, amount, due_date, category, notes } = req.body;
    const expense = dbInstance.db.fixed_expenses.find(
      (e) => e.id === id && e.user_id === req.user!.id
    );
    if (!expense) {
      return res.status(404).json({ detail: "Gasto fixo não encontrado." });
    }
    expense.name = String(name).trim();
    expense.amount = Number(amount) || 0;
    expense.due_date = due_date || null;
    expense.category = category || null;
    expense.notes = notes || null;
    expense.updated_at = new Date().toISOString();
    dbInstance.save();
    return res.json({ ...expense, paid: false, paid_at: null });
  });

  app.delete("/api/gastos-fixos/:id", authMiddleware, (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const idx = dbInstance.db.fixed_expenses.findIndex(
      (e) => e.id === id && e.user_id === req.user!.id
    );
    if (idx < 0) {
      return res.status(404).json({ detail: "Gasto fixo não encontrado." });
    }
    dbInstance.db.fixed_expenses.splice(idx, 1);
    dbInstance.save();
    return res.status(204).send();
  });

  app.patch("/api/gastos-fixos/:id/pagamento", authMiddleware, (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const { year, month, paid } = req.body;
    const expense = dbInstance.db.fixed_expenses.find(
      (e) => e.id === id && e.user_id === req.user!.id
    );
    if (!expense) {
      return res.status(404).json({ detail: "Gasto fixo não encontrado." });
    }
    let payment = dbInstance.db.fixed_expense_payments.find(
      (p) => p.expense_id === id && p.year === year && p.month === month && p.user_id === req.user!.id
    );
    const now = new Date().toISOString();
    if (payment) {
      payment.paid = Boolean(paid);
      payment.paid_at = paid ? now : null;
    } else {
      payment = {
        id: dbInstance.getNextId("fixed_expense_payments"),
        expense_id: id,
        user_id: req.user!.id,
        year,
        month,
        paid: Boolean(paid),
        paid_at: paid ? now : null,
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
      updated_at: expense.updated_at,
    });
  });

  // ================= GASTOS VARIÁVEIS =================
  app.get("/api/gastos-variaveis", authMiddleware, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const { start, end } = monthRange(year, month);
    const allUser = dbInstance.db.variable_expenses.filter((v) => v.user_id === req.user!.id);
    const items = allUser
      .filter((v) => v.date >= start && v.date <= end)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    return res.json(items.map((item) => enrichVariableExpense(allUser, item)));
  });

  app.post("/api/gastos-variaveis", authMiddleware, (req: AuthRequest, res) => {
    const { date: dateStr, type, amount, description, liters, odometer_km, fuel_kind } = req.body;
    if (!dateStr || !type || amount === undefined) {
      return res.status(400).json({ detail: "Data, tipo e valor são obrigatórios." });
    }
    const isFuel = String(type).toLowerCase() === "combustivel";
    const kind = String(fuel_kind || "").trim().toLowerCase();
    if (isFuel && kind && kind !== "etanol" && kind !== "gasolina") {
      return res.status(400).json({ detail: "Informe etanol ou gasolina." });
    }
    const item = {
      id: dbInstance.getNextId("variable_expenses"),
      user_id: req.user!.id,
      date: dateStr,
      type: String(type),
      amount: Number(amount) || 0,
      description: description || null,
      liters: isFuel && liters ? Number(liters) : null,
      odometer_km: isFuel && odometer_km ? Number(odometer_km) : null,
      fuel_kind: isFuel && kind ? kind : null,
      created_at: new Date().toISOString(),
    };
    dbInstance.db.variable_expenses.push(item);
    dbInstance.save();
    const allUser = dbInstance.db.variable_expenses.filter((v) => v.user_id === req.user!.id);
    return res.status(201).json(enrichVariableExpense(allUser, item));
  });

  app.delete("/api/gastos-variaveis/:id", authMiddleware, (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const idx = dbInstance.db.variable_expenses.findIndex(
      (v) => v.id === id && v.user_id === req.user!.id
    );
    if (idx < 0) {
      return res.status(404).json({ detail: "Gasto variável não encontrado." });
    }
    dbInstance.db.variable_expenses.splice(idx, 1);
    dbInstance.save();
    return res.status(204).send();
  });

  // ================= GANHOS DIÁRIOS =================
  app.get("/api/ganhos", authMiddleware, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const { start, end } = monthRange(year, month);
    const metas = calcularMetas(req.user!.id, year, month);
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    const items = dbInstance.db.daily_earnings
      .filter((e) => e.user_id === req.user!.id && e.date >= start && e.date <= end)
      .sort((a, b) => b.date.localeCompare(a.date));

    const result = items.map((e) => {
      const meta =
        e.date === today
          ? metas.meta_bruta_diaria
          : metas.meta_diaria_base ?? metas.meta_bruta_diaria;
      const faltam = Math.max(meta - e.gross_amount, 0);
      const atingida = e.gross_amount >= meta && meta > 0;
      const progresso = meta === 0 ? (e.gross_amount > 0 ? 100 : 0) : (e.gross_amount / meta) * 100;
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
        progresso_pct: roundMoney(Math.min(progresso, 999)),
      };
    });

    return res.json(result);
  });

  app.post("/api/ganhos", authMiddleware, (req: AuthRequest, res) => {
    const { date: dateStr, gross_amount, km_driven, hours_worked, notes } = req.body;
    if (!dateStr || gross_amount === undefined) {
      return res.status(400).json({ detail: "Data e valor bruto são obrigatórios." });
    }
    const [y, m] = dateStr.split("-").map(Number);

    let earning = dbInstance.db.daily_earnings.find(
      (e) => e.user_id === req.user!.id && e.date === dateStr
    );

    const now = new Date().toISOString();
    if (earning) {
      earning.gross_amount = Number(gross_amount) || 0;
      earning.km_driven = Number(km_driven) || 0;
      earning.hours_worked = hours_worked !== null && hours_worked !== undefined && hours_worked !== "" ? Number(hours_worked) : null;
      earning.notes = notes || null;
      earning.updated_at = now;
    } else {
      earning = {
        id: dbInstance.getNextId("daily_earnings"),
        user_id: req.user!.id,
        date: dateStr,
        gross_amount: Number(gross_amount) || 0,
        km_driven: Number(km_driven) || 0,
        hours_worked: hours_worked !== null && hours_worked !== undefined && hours_worked !== "" ? Number(hours_worked) : null,
        notes: notes || null,
        created_at: now,
        updated_at: now,
      };
      dbInstance.db.daily_earnings.push(earning);
    }
    dbInstance.save();

    const metas = calcularMetas(req.user!.id, y, m);
    const nowDate = new Date();
    const today = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-${String(
      nowDate.getDate()
    ).padStart(2, "0")}`;
    const meta =
      earning.date === today
        ? metas.meta_bruta_diaria
        : metas.meta_diaria_base ?? metas.meta_bruta_diaria;
    const faltam = Math.max(meta - earning.gross_amount, 0);
    const atingida = earning.gross_amount >= meta && meta > 0;
    const progresso = meta === 0 ? (earning.gross_amount > 0 ? 100 : 0) : (earning.gross_amount / meta) * 100;

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
      progresso_pct: roundMoney(Math.min(progresso, 999)),
    });
  });

  app.delete("/api/ganhos/:id", authMiddleware, (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const idx = dbInstance.db.daily_earnings.findIndex(
      (e) => e.id === id && e.user_id === req.user!.id
    );
    if (idx < 0) {
      return res.status(404).json({ detail: "Ganho diário não encontrado." });
    }
    dbInstance.db.daily_earnings.splice(idx, 1);
    dbInstance.save();
    return res.status(204).send();
  });

  // ================= VITE MIDDLEWARE / SPA FALLBACK =================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
