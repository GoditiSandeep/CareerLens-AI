"""Adaptive Growth Planner: weekly capacity + personal tasks/milestones.

Persistent, per-user planning data. Everything here is additive to the
existing schema — new tables are created by create_all and never touch
existing rows.
"""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base

# Allowed task categories (kept explicit so the UI and API agree).
TASK_CATEGORIES = (
    "learning",   # study a new skill / course module
    "revision",   # revise something already learned
    "project",    # build/advance a portfolio project
    "application",  # apply to jobs / internships
    "interview",  # interview practice / mock
)
TASK_STATUSES = ("todo", "in_progress", "completed", "skipped")


class PlannerSetting(Base):
    """One-per-user planning preferences + goal."""

    __tablename__ = "planner_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    target_role: Mapped[Optional[str]] = mapped_column(String(150))
    goal_deadline: Mapped[Optional[date]] = mapped_column(Date)
    hours_per_week: Mapped[float] = mapped_column(Float, default=8.0)
    study_days: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of weekday ints (0=Mon)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="planner_settings")


class PlannerTask(Base):
    """A single dated unit of work in the growth plan."""

    __tablename__ = "planner_tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(30), default="learning")
    target_date: Mapped[Optional[date]] = mapped_column(Date)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=60)
    # priority 1 = high, 2 = medium, 3 = low. Derived transparently (see planner.py).
    priority: Mapped[int] = mapped_column(Integer, default=2)
    status: Mapped[str] = mapped_column(String(20), default="todo")
    is_milestone: Mapped[bool] = mapped_column(Boolean, default=False)
    skill_tag: Mapped[Optional[str]] = mapped_column(String(120))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="planner_tasks")
