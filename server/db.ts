import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pix_key?: string;
  pix_key_type?: string;
  pix_name?: string;
  pix_city?: string;
}

export interface GoalSetting {
  id: number;
  user_id: number;
  monthly_net_profit: number;
  monthly_contingency: number;
  include_13th?: boolean;
  vacation_days_year?: number;
  planned_rest_days?: number;
  checkpoint_amount?: number;
  checkpoint_day?: number;
  updated_at: string;
}

export interface MonthlyGoal {
  id: number;
  user_id: number;
  year: number;
  month: number;
  monthly_net_profit: number;
  monthly_contingency: number;
  include_13th?: boolean;
  vacation_days_year?: number;
  planned_rest_days?: number;
  checkpoint_amount?: number;
  checkpoint_day?: number;
  updated_at: string;
}

export interface WorkRoutine {
  id: number;
  user_id: number;
  weekdays: number[]; // 0=segunda, 6=domingo
  hours_per_day: number;
  updated_at: string;
}

export interface WorkDayOverride {
  id: number;
  user_id: number;
  date: string; // YYYY-MM-DD
  working: boolean;
}

export interface FixedExpense {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  due_date?: string | null; // YYYY-MM-DD
  category?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedExpensePayment {
  id: number;
  expense_id: number;
  user_id: number;
  year: number;
  month: number;
  paid: boolean;
  paid_at?: string | null;
}

export interface VariableExpense {
  id: number;
  user_id: number;
  date: string; // YYYY-MM-DD
  type: string;
  amount: number;
  description?: string | null;
  liters?: number | null;
  odometer_km?: number | null;
  fuel_kind?: string | null;
  created_at: string;
}

export interface DailyEarning {
  id: number;
  user_id: number;
  date: string; // YYYY-MM-DD
  gross_amount: number;
  km_driven: number;
  hours_worked?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationCode {
  id: number;
  email: string;
  purpose: string;
  code: string;
  payload?: any;
  expires_at: string;
  created_at: string;
}

export interface DBData {
  users: User[];
  goal_settings: GoalSetting[];
  monthly_goals: MonthlyGoal[];
  work_routines: WorkRoutine[];
  work_day_overrides: WorkDayOverride[];
  fixed_expenses: FixedExpense[];
  fixed_expense_payments: FixedExpensePayment[];
  variable_expenses: VariableExpense[];
  daily_earnings: DailyEarning[];
  verification_codes: VerificationCode[];
  _nextId: { [key: string]: number };
}

const DB_FILE = path.join(process.cwd(), "data", "db.json");

function getDefaultData(): DBData {
  const defaultPasswordHash = bcrypt.hashSync("123456", 10);
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: 1,
        email: "marcos.mpab@gmail.com",
        name: "Marcos",
        password_hash: defaultPasswordHash,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    goal_settings: [
      {
        id: 1,
        user_id: 1,
        monthly_net_profit: 4000.0,
        monthly_contingency: 500.0,
        updated_at: now,
      },
    ],
    monthly_goals: [],
    work_routines: [
      {
        id: 1,
        user_id: 1,
        weekdays: [0, 1, 2, 3, 4], // Seg a Sex
        hours_per_day: 8.0,
        updated_at: now,
      },
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
      verification_codes: 1,
    },
  };
}

class Database {
  private data: DBData;

  constructor() {
    this.data = this.load();
  }

  private load(): DBData {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("Error loading db.json, resetting to defaults", e);
    }
    const def = getDefaultData();
    this.saveData(def);
    return def;
  }

  private saveData(data: DBData) {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  }

  public save() {
    this.saveData(this.data);
  }

  public get db(): DBData {
    return this.data;
  }

  public getNextId(table: keyof DBData["_nextId"]): number {
    if (!this.data._nextId[table]) {
      this.data._nextId[table] = 1;
    }
    const id = this.data._nextId[table]++;
    this.save();
    return id;
  }
}

export const dbInstance = new Database();
