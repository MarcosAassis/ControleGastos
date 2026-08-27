from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class WorkRoutine(Base):
    __tablename__ = "work_routines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    days_per_month: Mapped[int] = mapped_column(Integer, default=22)
    days_per_week: Mapped[int] = mapped_column(Integer, default=5)
    hours_per_day: Mapped[float] = mapped_column(Float, default=8.0)
    weekdays: Mapped[str] = mapped_column(String(40), default="[0,1,2,3,4]")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class WorkDayOverride(Base):
    __tablename__ = "work_day_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    working: Mapped[bool] = mapped_column(Boolean, default=True)


class GoalSettings(Base):
    __tablename__ = "goal_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    monthly_net_profit: Mapped[float] = mapped_column(Float, default=0.0)
    monthly_contingency: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FixedExpense(Base):
    __tablename__ = "fixed_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(20), default="casa")
    due_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    payments: Mapped[list["FixedExpensePayment"]] = relationship(
        back_populates="expense", cascade="all, delete-orphan"
    )


class FixedExpensePayment(Base):
    __tablename__ = "fixed_expense_payments"
    __table_args__ = (
        UniqueConstraint("expense_id", "year", "month", name="uq_payment_month"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    expense_id: Mapped[int] = mapped_column(
        ForeignKey("fixed_expenses.id", ondelete="CASCADE")
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    paid: Mapped[bool] = mapped_column(Boolean, default=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    expense: Mapped["FixedExpense"] = relationship(back_populates="payments")


class VariableExpense(Base):
    __tablename__ = "variable_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str] = mapped_column(String(200), default="")
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DailyEarning(Base):
    __tablename__ = "daily_earnings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False)
    gross_amount: Mapped[float] = mapped_column(Float, nullable=False)
    km_driven: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
