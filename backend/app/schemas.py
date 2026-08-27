from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=72)

    @field_validator("email")
    @classmethod
    def validar_email(cls, value: str) -> str:
        email = value.strip().lower()
        if "@" not in email or "." not in email.split("@")[-1]:
            raise ValueError("Informe um e-mail válido.")
        return email


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class WorkRoutineIn(BaseModel):
    weekdays: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])
    hours_per_day: float = Field(gt=0, le=24)

    @field_validator("weekdays")
    @classmethod
    def validar_weekdays(cls, value: list[int]) -> list[int]:
        return sorted({day for day in value if 0 <= int(day) <= 6})


class WorkRoutineOut(BaseModel):
    id: int
    weekdays: list[int]
    hours_per_day: float
    days_per_week: int
    days_per_month: int
    working_dates: list[date]
    overrides: dict[str, bool]
    updated_at: datetime


class WorkDayToggleIn(BaseModel):
    date: date


class GoalSettingsIn(BaseModel):
    monthly_net_profit: float = Field(ge=0)
    monthly_contingency: float = Field(ge=0)


class GoalSettingsOut(GoalSettingsIn):
    id: int
    updated_at: datetime

    model_config = {"from_attributes": True}


class FixedExpenseIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    amount: float = Field(gt=0)
    category: str = Field(pattern="^(casa|uber)$")
    due_date: date | None = None


class FixedExpenseOut(FixedExpenseIn):
    id: int
    paid: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentToggleIn(BaseModel):
    year: int
    month: int = Field(ge=1, le=12)
    paid: bool


class VariableExpenseIn(BaseModel):
    date: date
    type: str = Field(min_length=1, max_length=40)
    description: str = ""
    amount: float = Field(gt=0)


class VariableExpenseOut(VariableExpenseIn):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DailyEarningIn(BaseModel):
    date: date
    gross_amount: float = Field(ge=0)
    km_driven: float = Field(ge=0, default=0)
    notes: str | None = None


class DailyEarningOut(DailyEarningIn):
    id: int
    created_at: datetime
    updated_at: datetime
    meta_diaria: float = 0
    atingida: bool = False
    faltam: float = 0
    progresso_pct: float = 0

    model_config = {"from_attributes": True}


class MetasOut(BaseModel):
    gastos_fixos_mensal: float
    lucro_liquido_alvo: float
    reserva_imprevistos: float
    total_necessario: float
    custo_fixo_diario: float
    dias_trabalhados_mes: int
    dias_por_semana: int
    horas_por_dia: float
    meta_bruta_mensal: float
    meta_bruta_semanal: float
    meta_bruta_diaria: float
    meta_por_hora: float
    formula: str
