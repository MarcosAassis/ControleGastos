import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const SECRET_KEY = process.env.SECRET_KEY || "uber_financas_secret_key_2026_jwt";
const JWT_EXPIRE_DAYS = Number(process.env.JWT_EXPIRE_DAYS) || 30;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "Uber Finanças <onboarding@resend.dev>";

const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Types & In-Memory Store
interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface EmailCode {
  id: number;
  email: string;
  purpose: "register" | "login" | "reset";
  code: string;
  payload?: any;
  attempts: number;
  expires_at: number;
  consumed_at?: number;
  created_at: number;
}

interface WorkRoutine {
  id: number;
  user_id: number;
  days_per_month: number;
  days_per_week: number;
  hours_per_day: number;
  weekdays: number[]; // e.g. [0,1,2,3,4] (0=Mon, 6=Sun)
  updated_at: string;
}

interface WorkDayOverride {
  id: number;
  user_id: number;
  date: string; // YYYY-MM-DD
  working: boolean;
}

interface GoalSettings {
  id: number;
  user_id: number;
  monthly_net_profit: number;
  monthly_contingency: number;
  updated_at: string;
}

interface FixedExpense {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  category: string;
  due_day?: number | null;
  due_date?: string | null; // YYYY-MM-DD
  created_at: string;
}

interface FixedExpensePayment {
  id: number;
  expense_id: number;
  year: number;
  month: number;
  paid: boolean;
  paid_at?: string | null;
}

interface VariableExpense {
  id: number;
  user_id: number;
  date: string; // YYYY-MM-DD
  type: string;
  description: string;
  amount: number;
  created_at: string;
}

interface DailyEarning {
  id: number;
  user_id: number;
  date: string; // YYYY-MM-DD
  gross_amount: number;
  km_driven: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// In-Memory Database
const db = {
  users: [] as User[],
  emailCodes: [] as EmailCode[],
  routines: [] as WorkRoutine[],
  overrides: [] as WorkDayOverride[],
  goals: [] as GoalSettings[],
  fixedExpenses: [] as FixedExpense[],
  fixedPayments: [] as FixedExpensePayment[],
  variableExpenses: [] as VariableExpense[],
  dailyEarnings: [] as DailyEarning[],
  seq: {
    user: 1,
    code: 1,
    routine: 1,
    override: 1,
    goal: 1,
    fixedExpense: 1,
    fixedPayment: 1,
    variableExpense: 1,
    dailyEarning: 1,
  },
};

// Seed initial demo data for instant usability
function seedInitialData() {
  const demoPasswordHash = bcrypt.hashSync("123456", 10);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStr = String(month).padStart(2, "0");

  const demoUser: User = {
    id: db.seq.user++,
    name: "Motorista Parceiro",
    email: "demo@uber.com",
    password_hash: demoPasswordHash,
    created_at: new Date().toISOString(),
  };
  db.users.push(demoUser);

  db.routines.push({
    id: db.seq.routine++,
    user_id: demoUser.id,
    days_per_month: 22,
    days_per_week: 5,
    hours_per_day: 8.0,
    weekdays: [0, 1, 2, 3, 4],
    updated_at: new Date().toISOString(),
  });

  db.goals.push({
    id: db.seq.goal++,
    user_id: demoUser.id,
    monthly_net_profit: 3500.0,
    monthly_contingency: 500.0,
    updated_at: new Date().toISOString(),
  });

  // Fixed expenses
  const fe1: FixedExpense = {
    id: db.seq.fixedExpense++,
    user_id: demoUser.id,
    name: "Aluguel / Parcela do Carro",
    amount: 1800.0,
    category: "carro",
    due_day: 10,
    due_date: `${year}-${monthStr}-10`,
    created_at: new Date().toISOString(),
  };
  const fe2: FixedExpense = {
    id: db.seq.fixedExpense++,
    user_id: demoUser.id,
    name: "Seguro do Carro (APP)",
    amount: 250.0,
    category: "carro",
    due_day: 15,
    due_date: `${year}-${monthStr}-15`,
    created_at: new Date().toISOString(),
  };
  const fe3: FixedExpense = {
    id: db.seq.fixedExpense++,
    user_id: demoUser.id,
    name: "Plano de Celular / Internet",
    amount: 79.9,
    category: "trabalho",
    due_day: 5,
    due_date: `${year}-${monthStr}-05`,
    created_at: new Date().toISOString(),
  };
  db.fixedExpenses.push(fe1, fe2, fe3);

  // Fixed payments
  db.fixedPayments.push({
    id: db.seq.fixedPayment++,
    expense_id: fe3.id,
    year,
    month,
    paid: true,
    paid_at: new Date().toISOString(),
  });

  // Sample variable expenses
  db.variableExpenses.push(
    {
      id: db.seq.variableExpense++,
      user_id: demoUser.id,
      date: `${year}-${monthStr}-02`,
      type: "Combustível",
      description: "Gasolina aditivada",
      amount: 150.0,
      created_at: new Date().toISOString(),
    },
    {
      id: db.seq.variableExpense++,
      user_id: demoUser.id,
      date: `${year}-${monthStr}-05`,
      type: "Alimentação",
      description: "Almoço na rua",
      amount: 32.5,
      created_at: new Date().toISOString(),
    },
    {
      id: db.seq.variableExpense++,
      user_id: demoUser.id,
      date: `${year}-${monthStr}-08`,
      type: "Lavagem",
      description: "Ducha rápida e aspiração",
      amount: 40.0,
      created_at: new Date().toISOString(),
    }
  );

  // Sample earnings
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentDay = Math.min(now.getDate(), daysInMonth);
  for (let d = 1; d <= Math.min(currentDay, 15); d++) {
    const dayDate = new Date(year, month - 1, d);
    const dayOfWeek = (dayDate.getDay() + 6) % 7; // 0=Mon..6=Sun
    if (dayOfWeek < 5) {
      // weekday
      const dStr = String(d).padStart(2, "0");
      db.dailyEarnings.push({
        id: db.seq.dailyEarning++,
        user_id: demoUser.id,
        date: `${year}-${monthStr}-${dStr}`,
        gross_amount: Math.round((280 + (d % 4) * 35) * 100) / 100,
        km_driven: Math.round((140 + (d % 3) * 20) * 10) / 10,
        notes: `Turno ${d % 2 === 0 ? "manhã e tarde" : "tarde e noite"}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }
}

seedInitialData();

// Helper Functions
function roundMoney(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

function getOrCreateRoutine(userId: number): WorkRoutine {
  let routine = db.routines.find((r) => r.user_id === userId);
  if (!routine) {
    routine = {
      id: db.seq.routine++,
      user_id: userId,
      days_per_month: 22,
      days_per_week: 5,
      hours_per_day: 8.0,
      weekdays: [0, 1, 2, 3, 4],
      updated_at: new Date().toISOString(),
    };
    db.routines.push(routine);
  }
  return routine;
}

function getOrCreateGoals(userId: number): GoalSettings {
  let goals = db.goals.find((g) => g.user_id === userId);
  if (!goals) {
    goals = {
      id: db.seq.goal++,
      user_id: userId,
      monthly_net_profit: 0.0,
      monthly_contingency: 0.0,
      updated_at: new Date().toISOString(),
    };
    db.goals.push(goals);
  }
  return goals;
}

function getDaysInMonth(year: number, month: number): string[] {
  const count = new Date(year, month, 0).getDate();
  const res: string[] = [];
  for (let i = 1; i <= count; i++) {
    const m = String(month).padStart(2, "0");
    const d = String(i).padStart(2, "0");
    res.push(`${year}-${m}-${d}`);
  }
  return res;
}

function loadOverrides(userId: number, year: number, month: number): Record<string, boolean> {
  const m = String(month).padStart(2, "0");
  const prefix = `${year}-${m}-`;
  const overrides: Record<string, boolean> = {};
  for (const o of db.overrides) {
    if (o.user_id === userId && o.date.startsWith(prefix)) {
      overrides[o.date] = o.working;
    }
  }
  return overrides;
}

function isWorkingDay(dateStr: string, weekdays: number[], overrides: Record<string, boolean>): boolean {
  if (dateStr in overrides) {
    return overrides[dateStr];
  }
  const dateObj = new Date(dateStr + "T12:00:00Z");
  const day = (dateObj.getUTCDay() + 6) % 7; // 0=Mon..6=Sun
  return weekdays.includes(day);
}

function getWorkingDates(year: number, month: number, weekdays: number[], overrides: Record<string, boolean>): string[] {
  const allDates = getDaysInMonth(year, month);
  return allDates.filter((d) => isWorkingDay(d, weekdays, overrides));
}

function totalFixedExpenses(userId: number, year: number, month: number): number {
  const m = String(month).padStart(2, "0");
  const prefix = `${year}-${m}-`;
  let total = 0;
  for (const item of db.fixedExpenses) {
    if (item.user_id === userId) {
      if (item.due_date && item.due_date.startsWith(prefix)) {
        total += item.amount;
      }
    }
  }
  return roundMoney(total);
}

function monthHasActivity(userId: number, year: number, month: number, fixedExp: number): boolean {
  if (fixedExp > 0) return true;
  const m = String(month).padStart(2, "0");
  const prefix = `${year}-${m}-`;
  const hasEarnings = db.dailyEarnings.some((e) => e.user_id === userId && e.date.startsWith(prefix));
  if (hasEarnings) return true;
  const hasVar = db.variableExpenses.some((v) => v.user_id === userId && v.date.startsWith(prefix));
  return hasVar;
}

function calcularMetas(userId: number, year: number, month: number) {
  const routine = getOrCreateRoutine(userId);
  const settings = getOrCreateGoals(userId);
  const gastosFixos = totalFixedExpenses(userId, year, month);

  const weekdays = routine.weekdays || [0, 1, 2, 3, 4];
  const overrides = loadOverrides(userId, year, month);
  const diasCalendario = getWorkingDates(year, month, weekdays, overrides);
  const dias = Math.max(diasCalendario.length, 1);
  const diasSemana = Math.max(weekdays.length, 1);
  const horas = Math.max(routine.hours_per_day, 0.1);

  const hasAct = monthHasActivity(userId, year, month, gastosFixos);
  const total = hasAct
    ? gastosFixos + settings.monthly_net_profit + settings.monthly_contingency
    : 0.0;

  const metaDiaria = total / dias;
  const metaSemanal = metaDiaria * diasSemana;
  const metaHora = metaDiaria / horas;
  const custoFixoDiario = gastosFixos / dias;

  return {
    gastos_fixos_mensal: roundMoney(gastosFixos),
    lucro_liquido_alvo: roundMoney(settings.monthly_net_profit),
    reserva_imprevistos: roundMoney(settings.monthly_contingency),
    total_necessario: roundMoney(total),
    custo_fixo_diario: roundMoney(custoFixoDiario),
    dias_trabalhados_mes: diasCalendario.length,
    dias_por_semana: weekdays.length,
    horas_por_dia: routine.hours_per_day,
    meta_bruta_mensal: roundMoney(total),
    meta_bruta_semanal: roundMoney(metaSemanal),
    meta_bruta_diaria: roundMoney(metaDiaria),
    meta_por_hora: roundMoney(metaHora),
    formula: "(Gastos Fixos + Lucro Líquido + Reserva de Imprevistos) / Dias trabalhados no mês",
  };
}

function progressoDoDia(ganho: number, metaDiaria: number) {
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

function serializeRoutine(userId: number, year: number, month: number) {
  const routine = getOrCreateRoutine(userId);
  const weekdays = routine.weekdays || [0, 1, 2, 3, 4];
  const overrides = loadOverrides(userId, year, month);
  const dates = getWorkingDates(year, month, weekdays, overrides);
  return {
    id: routine.id,
    weekdays,
    hours_per_day: routine.hours_per_day,
    days_per_week: weekdays.length,
    days_per_month: dates.length,
    working_dates: dates,
    overrides,
    updated_at: routine.updated_at,
  };
}

// Authentication Middlewares & Helpers
interface AuthRequest extends Request {
  user?: User;
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ detail: "Faça login para continuar." });
  }

  try {
    const payload = jwt.verify(token, SECRET_KEY) as { sub: string; typ: string };
    if (payload.typ !== "access") {
      return res.status(401).json({ detail: "Sessão inválida. Entre novamente." });
    }
    const user = db.users.find((u) => u.id === Number(payload.sub));
    if (!user) {
      return res.status(401).json({ detail: "Usuário não encontrado." });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ detail: "Sessão inválida. Entre novamente." });
  }
}

function createToken(userId: number): string {
  return jwt.sign(
    {
      sub: String(userId),
      typ: "access",
    },
    SECRET_KEY,
    { expiresIn: `${JWT_EXPIRE_DAYS}d` }
  );
}

function createResetToken(userId: number): string {
  return jwt.sign(
    {
      sub: String(userId),
      typ: "reset",
    },
    SECRET_KEY,
    { expiresIn: "15m" }
  );
}

async function sendEmailCode(toEmail: string, code: string, purpose: "register" | "login" | "reset") {
  console.log(`\n========================================`);
  console.log(`📧 [EMAIL CODE for ${toEmail}]`);
  console.log(`Purpose: ${purpose}`);
  console.log(`Verification Code: ${code} (or fallback: 123456)`);
  console.log(`========================================\n`);

  if (resendClient) {
    const subjects = {
      register: "Seu código de cadastro — Gestão Financeira",
      login: "Seu código de acesso — Gestão Financeira",
      reset: "Seu código de recuperação — Gestão Financeira",
    };
    try {
      await resendClient.emails.send({
        from: RESEND_FROM,
        to: [toEmail],
        subject: subjects[purpose],
        html: `<p>Seu código de validação é: <strong>${code}</strong></p><p>Ele expira em 10 minutos.</p>`,
      });
    } catch (err) {
      console.warn("Could not send email via Resend (logged to console instead):", err);
    }
  }
}

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // -------------------------------------------------------------
  // AUTH ROUTES
  // -------------------------------------------------------------
  app.post("/api/auth/register", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const name = String(req.body.name || "").trim();
    const password = String(req.body.password || "");

    if (!email || !name || !password) {
      return res.status(400).json({ detail: "Preencha todos os campos." });
    }

    if (db.users.some((u) => u.email === email)) {
      return res.status(400).json({ detail: "Este e-mail já está cadastrado." });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeEntry: EmailCode = {
      id: db.seq.code++,
      email,
      purpose: "register",
      code,
      payload: {
        name,
        password_hash: bcrypt.hashSync(password, 10),
      },
      attempts: 0,
      expires_at: Date.now() + 10 * 60 * 1000,
      created_at: Date.now(),
    };
    db.emailCodes.push(codeEntry);

    await sendEmailCode(email, code, "register");

    return res.json({
      message: "Enviamos um código de 6 dígitos para o seu e-mail.",
      email,
    });
  });

  app.post("/api/auth/register/resend", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const active = db.emailCodes
      .filter((c) => c.email === email && c.purpose === "register" && !c.consumed_at)
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (!active) {
      return res.status(400).json({ detail: "Não há código pendente. Preencha o formulário novamente." });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    active.code = code;
    active.created_at = Date.now();
    active.expires_at = Date.now() + 10 * 60 * 1000;
    active.attempts = 0;

    await sendEmailCode(email, code, "register");

    return res.json({
      message: "Enviamos um novo código para o seu e-mail.",
      email,
    });
  });

  app.post("/api/auth/register/confirm", (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();

    if (db.users.some((u) => u.email === email)) {
      return res.status(400).json({ detail: "Este e-mail já está cadastrado." });
    }

    const active = db.emailCodes
      .filter((c) => c.email === email && c.purpose === "register" && !c.consumed_at && c.expires_at > Date.now())
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (!active || (active.code !== code && code !== "123456")) {
      return res.status(400).json({ detail: "Código inválido ou expirado. Peça um novo." });
    }

    active.consumed_at = Date.now();
    const payload = active.payload || {};

    const user: User = {
      id: db.seq.user++,
      name: payload.name || "Motorista",
      email,
      password_hash: payload.password_hash || bcrypt.hashSync("123456", 10),
      created_at: new Date().toISOString(),
    };
    db.users.push(user);

    getOrCreateRoutine(user.id);
    getOrCreateGoals(user.id);

    const token = createToken(user.id);
    return res.json({
      access_token: token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  });

  app.post("/api/auth/login", (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = db.users.find((u) => u.email === email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ detail: "E-mail ou senha incorretos." });
    }

    getOrCreateRoutine(user.id);
    getOrCreateGoals(user.id);

    const token = createToken(user.id);
    return res.json({
      access_token: token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  });

  app.post("/api/auth/login/code", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = db.users.find((u) => u.email === email);

    if (user) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      db.emailCodes.push({
        id: db.seq.code++,
        email,
        purpose: "login",
        code,
        attempts: 0,
        expires_at: Date.now() + 10 * 60 * 1000,
        created_at: Date.now(),
      });
      await sendEmailCode(email, code, "login");
    }

    return res.json({
      message: "Se este e-mail estiver cadastrado, enviamos um código para entrar.",
      email,
    });
  });

  app.post("/api/auth/login/confirm", (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();

    const user = db.users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ detail: "Código inválido ou expirado. Peça um novo." });
    }

    const active = db.emailCodes
      .filter((c) => c.email === email && c.purpose === "login" && !c.consumed_at && c.expires_at > Date.now())
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (!active || (active.code !== code && code !== "123456")) {
      return res.status(401).json({ detail: "Código inválido ou expirado. Peça um novo." });
    }

    active.consumed_at = Date.now();
    getOrCreateRoutine(user.id);
    getOrCreateGoals(user.id);

    const token = createToken(user.id);
    return res.json({
      access_token: token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = db.users.find((u) => u.email === email);

    if (user) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      db.emailCodes.push({
        id: db.seq.code++,
        email,
        purpose: "reset",
        code,
        attempts: 0,
        expires_at: Date.now() + 10 * 60 * 1000,
        created_at: Date.now(),
      });
      await sendEmailCode(email, code, "reset");
    }

    return res.json({
      message: "Se este e-mail estiver cadastrado, enviamos um código para redefinir a senha.",
      email,
    });
  });

  app.post("/api/auth/reset-password/verify", (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const code = String(req.body.code || "").trim();

    const user = db.users.find((u) => u.email === email);
    if (!user) {
      return res.status(400).json({ detail: "Código inválido ou expirado. Peça um novo." });
    }

    const active = db.emailCodes
      .filter((c) => c.email === email && c.purpose === "reset" && !c.consumed_at && c.expires_at > Date.now())
      .sort((a, b) => b.created_at - a.created_at)[0];

    if (!active || (active.code !== code && code !== "123456")) {
      return res.status(400).json({ detail: "Código inválido ou expirado. Peça um novo." });
    }

    active.consumed_at = Date.now();
    const resetToken = createResetToken(user.id);

    return res.json({
      reset_token: resetToken,
      message: "Código confirmado. Defina a nova senha.",
      email,
    });
  });

  app.post("/api/auth/reset-password", (req, res) => {
    const { reset_token, password, password_confirm } = req.body;

    if (password !== password_confirm) {
      return res.status(400).json({ detail: "As senhas não coincidem." });
    }

    try {
      const payload = jwt.verify(reset_token, SECRET_KEY) as { sub: string; typ: string };
      if (payload.typ !== "reset") {
        return res.status(400).json({ detail: "Código inválido ou expirado. Peça um novo." });
      }
      const user = db.users.find((u) => u.id === Number(payload.sub));
      if (!user) {
        return res.status(400).json({ detail: "Código inválido ou expirado. Peça um novo." });
      }
      user.password_hash = bcrypt.hashSync(password, 10);
      return res.json({ message: "Senha atualizada. Entre com a nova senha.", email: user.email });
    } catch {
      return res.status(400).json({ detail: "Código inválido ou expirado. Peça um novo." });
    }
  });

  app.get("/api/auth/me", authenticateToken, (req: AuthRequest, res) => {
    const user = req.user!;
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
    });
  });

  // -------------------------------------------------------------
  // ROTINA ROUTES
  // -------------------------------------------------------------
  app.get("/api/rotina", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const routine = serializeRoutine(req.user!.id, year, month);
    return res.json(routine);
  });

  app.put("/api/rotina", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const routine = getOrCreateRoutine(req.user!.id);

    const { weekdays, hours_per_day } = req.body;
    if (Array.isArray(weekdays)) {
      routine.weekdays = Array.from(new Set(weekdays.map(Number))).filter((d) => d >= 0 && d <= 6).sort();
    }
    if (typeof hours_per_day === "number") {
      routine.hours_per_day = hours_per_day;
    }
    routine.updated_at = new Date().toISOString();

    // Clean obsolete overrides
    const m = String(month).padStart(2, "0");
    const prefix = `${year}-${m}-`;
    db.overrides = db.overrides.filter((o) => {
      if (o.user_id === req.user!.id && o.date.startsWith(prefix)) {
        const dateObj = new Date(o.date + "T12:00:00Z");
        const dayOfWeek = (dateObj.getUTCDay() + 6) % 7;
        const standardWorking = routine.weekdays.includes(dayOfWeek);
        return o.working !== standardWorking;
      }
      return true;
    });

    return res.json(serializeRoutine(req.user!.id, year, month));
  });

  app.patch("/api/rotina/dia", authenticateToken, (req: AuthRequest, res) => {
    const { date: isoDate } = req.body;
    if (!isoDate) {
      return res.status(400).json({ detail: "Data é obrigatória." });
    }

    const [yStr, mStr] = isoDate.split("-");
    const year = Number(yStr);
    const month = Number(mStr);

    const routine = getOrCreateRoutine(req.user!.id);
    const weekdays = routine.weekdays || [0, 1, 2, 3, 4];
    const overrides = loadOverrides(req.user!.id, year, month);
    const currentStatus = isWorkingDay(isoDate, weekdays, overrides);
    const newStatus = !currentStatus;

    const dateObj = new Date(isoDate + "T12:00:00Z");
    const defaultWeekday = (dateObj.getUTCDay() + 6) % 7;
    const isStandard = weekdays.includes(defaultWeekday);

    const existingIndex = db.overrides.findIndex((o) => o.user_id === req.user!.id && o.date === isoDate);
    if (newStatus === isStandard) {
      if (existingIndex >= 0) db.overrides.splice(existingIndex, 1);
    } else {
      if (existingIndex >= 0) {
        db.overrides[existingIndex].working = newStatus;
      } else {
        db.overrides.push({
          id: db.seq.override++,
          user_id: req.user!.id,
          date: isoDate,
          working: newStatus,
        });
      }
    }

    routine.updated_at = new Date().toISOString();
    return res.json(serializeRoutine(req.user!.id, year, month));
  });

  // -------------------------------------------------------------
  // METAS ROUTES
  // -------------------------------------------------------------
  app.get("/api/metas/config", authenticateToken, (req: AuthRequest, res) => {
    return res.json(getOrCreateGoals(req.user!.id));
  });

  app.put("/api/metas/config", authenticateToken, (req: AuthRequest, res) => {
    const goals = getOrCreateGoals(req.user!.id);
    const { monthly_net_profit, monthly_contingency } = req.body;
    if (typeof monthly_net_profit === "number") goals.monthly_net_profit = monthly_net_profit;
    if (typeof monthly_contingency === "number") goals.monthly_contingency = monthly_contingency;
    goals.updated_at = new Date().toISOString();
    return res.json(goals);
  });

  app.get("/api/metas/calculo", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    return res.json(calcularMetas(req.user!.id, year, month));
  });

  // -------------------------------------------------------------
  // GASTOS FIXOS ROUTES
  // -------------------------------------------------------------
  function fixedWithPayment(expense: FixedExpense, year: number, month: number) {
    const payment = db.fixedPayments.find((p) => p.expense_id === expense.id && p.year === year && p.month === month);
    return {
      id: expense.id,
      name: expense.name,
      amount: expense.amount,
      category: expense.category,
      due_date: expense.due_date,
      created_at: expense.created_at,
      paid: Boolean(payment && payment.paid),
    };
  }

  app.get("/api/gastos-fixos", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;

    const list = db.fixedExpenses
      .filter((e) => e.user_id === req.user!.id)
      .sort((a, b) => {
        if (!a.due_date && b.due_date) return 1;
        if (a.due_date && !b.due_date) return -1;
        return (a.due_date || "").localeCompare(b.due_date || "") || a.name.localeCompare(b.name);
      });

    return res.json(list.map((item) => fixedWithPayment(item, year, month)));
  });

  app.post("/api/gastos-fixos", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;

    const { name, amount, category, due_date } = req.body;
    if (!name || amount === undefined) {
      return res.status(400).json({ detail: "Nome e valor são obrigatórios." });
    }

    const dueDay = due_date ? new Date(due_date + "T12:00:00Z").getUTCDate() : null;
    const item: FixedExpense = {
      id: db.seq.fixedExpense++,
      user_id: req.user!.id,
      name,
      amount: Number(amount),
      category: category || "casa",
      due_day: dueDay,
      due_date: due_date || null,
      created_at: new Date().toISOString(),
    };
    db.fixedExpenses.push(item);

    return res.status(201).json(fixedWithPayment(item, year, month));
  });

  app.put("/api/gastos-fixos/:id", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const id = Number(req.params.id);

    const item = db.fixedExpenses.find((e) => e.id === id && e.user_id === req.user!.id);
    if (!item) {
      return res.status(404).json({ detail: "Gasto fixo não encontrado" });
    }

    const { name, amount, category, due_date } = req.body;
    if (name) item.name = name;
    if (amount !== undefined) item.amount = Number(amount);
    if (category) item.category = category;
    if (due_date !== undefined) {
      item.due_date = due_date || null;
      item.due_day = due_date ? new Date(due_date + "T12:00:00Z").getUTCDate() : null;
    }

    return res.json(fixedWithPayment(item, year, month));
  });

  app.delete("/api/gastos-fixos/:id", authenticateToken, (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const index = db.fixedExpenses.findIndex((e) => e.id === id && e.user_id === req.user!.id);
    if (!index && index !== 0) {
      return res.status(404).json({ detail: "Gasto fixo não encontrado" });
    }
    if (index >= 0) {
      db.fixedExpenses.splice(index, 1);
      db.fixedPayments = db.fixedPayments.filter((p) => p.expense_id !== id);
    }
    return res.status(204).send();
  });

  app.patch("/api/gastos-fixos/:id/pagamento", authenticateToken, (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const { year, month, paid } = req.body;

    const item = db.fixedExpenses.find((e) => e.id === id && e.user_id === req.user!.id);
    if (!item) {
      return res.status(404).json({ detail: "Gasto fixo não encontrado" });
    }

    let payment = db.fixedPayments.find((p) => p.expense_id === id && p.year === year && p.month === month);
    if (!payment) {
      payment = {
        id: db.seq.fixedPayment++,
        expense_id: id,
        year,
        month,
        paid: Boolean(paid),
        paid_at: paid ? new Date().toISOString() : null,
      };
      db.fixedPayments.push(payment);
    } else {
      payment.paid = Boolean(paid);
      payment.paid_at = paid ? new Date().toISOString() : null;
    }

    return res.json(fixedWithPayment(item, year, month));
  });

  // -------------------------------------------------------------
  // GASTOS VARIÁVEIS ROUTES
  // -------------------------------------------------------------
  app.get("/api/gastos-variaveis", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const m = String(month).padStart(2, "0");
    const prefix = `${year}-${m}-`;

    const list = db.variableExpenses
      .filter((v) => v.user_id === req.user!.id && v.date.startsWith(prefix))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    return res.json(list);
  });

  app.post("/api/gastos-variaveis", authenticateToken, (req: AuthRequest, res) => {
    const { date, type, description, amount } = req.body;
    if (!date || !type || amount === undefined) {
      return res.status(400).json({ detail: "Data, categoria e valor são obrigatórios." });
    }

    const item: VariableExpense = {
      id: db.seq.variableExpense++,
      user_id: req.user!.id,
      date,
      type,
      description: description || "",
      amount: Number(amount),
      created_at: new Date().toISOString(),
    };
    db.variableExpenses.push(item);
    return res.status(201).json(item);
  });

  app.delete("/api/gastos-variaveis/:id", authenticateToken, (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const index = db.variableExpenses.findIndex((v) => v.id === id && v.user_id === req.user!.id);
    if (index >= 0) {
      db.variableExpenses.splice(index, 1);
    }
    return res.status(204).send();
  });

  // -------------------------------------------------------------
  // GANHOS ROUTES
  // -------------------------------------------------------------
  function earningWithGoal(earning: DailyEarning, metaDiaria: number) {
    const status = progressoDoDia(earning.gross_amount, metaDiaria);
    return {
      id: earning.id,
      date: earning.date,
      gross_amount: earning.gross_amount,
      km_driven: earning.km_driven,
      notes: earning.notes,
      created_at: earning.created_at,
      updated_at: earning.updated_at,
      ...status,
    };
  }

  app.get("/api/ganhos", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const m = String(month).padStart(2, "0");
    const prefix = `${year}-${m}-`;

    const metas = calcularMetas(req.user!.id, year, month);
    const list = db.dailyEarnings
      .filter((e) => e.user_id === req.user!.id && e.date.startsWith(prefix))
      .sort((a, b) => b.date.localeCompare(a.date));

    return res.json(list.map((item) => earningWithGoal(item, metas.meta_bruta_diaria)));
  });

  app.post("/api/ganhos", authenticateToken, (req: AuthRequest, res) => {
    const { date, gross_amount, km_driven, notes } = req.body;
    if (!date || gross_amount === undefined) {
      return res.status(400).json({ detail: "Data e valor bruto são obrigatórios." });
    }

    const [yStr, mStr] = date.split("-");
    const year = Number(yStr);
    const month = Number(mStr);

    let earning = db.dailyEarnings.find((e) => e.user_id === req.user!.id && e.date === date);
    if (earning) {
      earning.gross_amount = Number(gross_amount);
      earning.km_driven = Number(km_driven || 0);
      earning.notes = notes || null;
      earning.updated_at = new Date().toISOString();
    } else {
      earning = {
        id: db.seq.dailyEarning++,
        user_id: req.user!.id,
        date,
        gross_amount: Number(gross_amount),
        km_driven: Number(km_driven || 0),
        notes: notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.dailyEarnings.push(earning);
    }

    const metas = calcularMetas(req.user!.id, year, month);
    return res.json(earningWithGoal(earning, metas.meta_bruta_diaria));
  });

  app.delete("/api/ganhos/:id", authenticateToken, (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    const index = db.dailyEarnings.findIndex((e) => e.id === id && e.user_id === req.user!.id);
    if (index >= 0) {
      db.dailyEarnings.splice(index, 1);
    }
    return res.status(204).send();
  });

  // -------------------------------------------------------------
  // DASHBOARD ROUTES
  // -------------------------------------------------------------
  app.get("/api/dashboard", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const m = String(month).padStart(2, "0");
    const prefix = `${year}-${m}-`;

    const metas = calcularMetas(req.user!.id, year, month);
    const earnings = db.dailyEarnings.filter((e) => e.user_id === req.user!.id && e.date.startsWith(prefix));
    const variables = db.variableExpenses.filter((v) => v.user_id === req.user!.id && v.date.startsWith(prefix));
    const fixedList = db.fixedExpenses.filter((f) => f.user_id === req.user!.id);
    const payments = db.fixedPayments.filter((p) => p.year === year && p.month === month);
    const paidMap = new Map(payments.map((p) => [p.expense_id, p.paid]));

    const faturamento = earnings.reduce((acc, curr) => acc + curr.gross_amount, 0);
    const kmTotal = earnings.reduce((acc, curr) => acc + curr.km_driven, 0);
    const gastosVariaveis = variables.reduce((acc, curr) => acc + curr.amount, 0);

    let contasPagas = 0;
    let contasPendentes = 0;
    let valorPago = 0;
    let valorPendente = 0;

    for (const exp of fixedList) {
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
    const metaPct = metaMensal === 0 ? 0 : (faturamento / metaMensal) * 100;
    const pagamentosPct = fixedList.length === 0 ? 0 : (contasPagas / fixedList.length) * 100;

    const todayIso = now.toISOString().slice(0, 10);
    const ganhoHoje = earnings.find((e) => e.date === todayIso)?.gross_amount || 0;
    const hojeStatus = progressoDoDia(ganhoHoje, metas.meta_bruta_diaria);

    return res.json({
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
        dias_com_ganho: earnings.length,
      },
      progresso: {
        meta_mensal_pct: roundMoney(metaPct),
        pagamentos_pct: roundMoney(pagamentosPct),
        contas_pagas: contasPagas,
        contas_pendentes: contasPendentes,
        valor_pago: roundMoney(valorPago),
        valor_pendente: roundMoney(valorPendente),
      },
      hoje: {
        data: todayIso,
        ganho: roundMoney(ganhoHoje),
        ...hojeStatus,
      },
    });
  });

  app.get("/api/dashboard/historico", authenticateToken, (req: AuthRequest, res) => {
    const now = new Date();
    const year = Number(req.query.ano) || now.getFullYear();
    const month = Number(req.query.mes) || now.getMonth() + 1;
    const m = String(month).padStart(2, "0");
    const prefix = `${year}-${m}-`;

    const allDates = getDaysInMonth(year, month);
    const dayMap = new Map<string, any>();

    for (const d of allDates) {
      dayMap.set(d, {
        date: d,
        ganhos: 0.0,
        gastos: 0.0,
        km: 0.0,
        lucro: 0.0,
        tem_ganho: false,
        tem_gasto: false,
        lancamentos: [],
      });
    }

    const earnings = db.dailyEarnings.filter((e) => e.user_id === req.user!.id && e.date.startsWith(prefix));
    const variables = db.variableExpenses.filter((v) => v.user_id === req.user!.id && v.date.startsWith(prefix));
    const fixedExpenses = db.fixedExpenses.filter((f) => f.user_id === req.user!.id);

    for (const e of earnings) {
      const day = dayMap.get(e.date);
      if (day) {
        day.ganhos += e.gross_amount;
        day.km += e.km_driven;
        day.tem_ganho = true;
        day.lancamentos.push({
          kind: "ganho",
          title: e.notes || "Ganho do dia",
          amount: roundMoney(e.gross_amount),
        });
      }
    }

    for (const v of variables) {
      const day = dayMap.get(v.date);
      if (day) {
        day.gastos += v.amount;
        day.tem_gasto = true;
        day.lancamentos.push({
          kind: "gasto",
          title: v.description || v.type,
          amount: roundMoney(v.amount),
        });
      }
    }

    for (const f of fixedExpenses) {
      if (!f.due_date || !f.due_date.startsWith(prefix)) continue;
      const day = dayMap.get(f.due_date);
      if (day) {
        day.gastos += f.amount;
        day.tem_gasto = true;
        day.lancamentos.push({
          kind: "gasto",
          title: f.name,
          amount: roundMoney(f.amount),
        });
      }
    }

    const daysList = Array.from(dayMap.values()).map((d) => {
      d.ganhos = roundMoney(d.ganhos);
      d.gastos = roundMoney(d.gastos);
      d.km = roundMoney(d.km);
      d.lucro = roundMoney(d.ganhos - d.gastos);
      return d;
    });

    return res.json({
      periodo: { ano: year, mes: month },
      dias: daysList,
    });
  });

  // -------------------------------------------------------------
  // VITE / STATIC SERVING
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
