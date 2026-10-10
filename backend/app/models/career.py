"""Skills, career paths, roadmaps."""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
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


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(60), default="technical")
    level: Mapped[int] = mapped_column(
        Integer, default=50
    )  # generic/market level 0-100


class StudentSkill(Base):
    __tablename__ = "student_skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60), default="technical")
    level: Mapped[float] = mapped_column(Float, default=30)  # current 0-100
    target_level: Mapped[float] = mapped_column(Float, default=70)

    user: Mapped["User"] = relationship(back_populates="skills")


class CareerPath(Base):
    __tablename__ = "career_paths"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(60))
    description: Mapped[str] = mapped_column(Text)
    # JSON: required skills map {name: level}, responsibilities, etc.
    required_skills: Mapped[str] = mapped_column(Text, default="[]")
    responsibilities: Mapped[str] = mapped_column(Text, default="[]")
    roadmap: Mapped[str] = mapped_column(Text, default="[]")  # month -> items
    projects: Mapped[str] = mapped_column(Text, default="[]")
    interview_topics: Mapped[str] = mapped_column(Text, default="[]")
    certifications: Mapped[str] = mapped_column(Text, default="[]")
    salary_range: Mapped[str] = mapped_column(String(120))
    demand_level: Mapped[str] = mapped_column(String(30))
    growth_potential: Mapped[str] = mapped_column(String(30), default="High")


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    career_path_name: Mapped[str] = mapped_column(String(150))
    title: Mapped[str] = mapped_column(String(200))
    total_months: Mapped[int] = mapped_column(Integer, default=6)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    progress: Mapped[float] = mapped_column(Float, default=0.0)

    user: Mapped["User"] = relationship(back_populates="roadmaps")
    items: Mapped[list["RoadmapItem"]] = relationship(
        back_populates="roadmap", cascade="all, delete-orphan"
    )


class RoadmapItem(Base):
    __tablename__ = "roadmap_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    roadmap_id: Mapped[int] = mapped_column(
        ForeignKey("roadmaps.id", ondelete="CASCADE")
    )
    month: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(60), default="learning")
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending/in_progress/completed
    deadline: Mapped[Optional[date]] = mapped_column(Date)
    resources: Mapped[str] = mapped_column(Text, default="[]")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    roadmap: Mapped["Roadmap"] = relationship(back_populates="items")
