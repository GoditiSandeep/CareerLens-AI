"""Jobs, saved jobs, applications."""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(180))
    company: Mapped[str] = mapped_column(String(180))
    location: Mapped[str] = mapped_column(String(120), default="Remote")
    work_mode: Mapped[str] = mapped_column(String(30), default="remote")
    salary: Mapped[str] = mapped_column(String(120), default="")
    job_type: Mapped[str] = mapped_column(String(30), default="job")  # job/internship
    skills: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    experience_label: Mapped[str] = mapped_column(String(60), default="Fresher")
    description: Mapped[str] = mapped_column(Text, default="")
    industry: Mapped[str] = mapped_column(String(120), default="Technology")
    # True for seeded/demo listings (shown as "sample data" in the UI).
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    posted_on: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SavedJob(Base):
    __tablename__ = "saved_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"))
    saved_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="saved_jobs")
    job: Mapped["Job"] = relationship()


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    job_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True
    )
    company: Mapped[str] = mapped_column(String(180))
    role: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(
        String(30), default="wishlist"
    )  # wishlist/applied/assessment/interview/offer/rejected
    applied_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime)
    job_url: Mapped[Optional[str]] = mapped_column(String(500))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="applications")
    job: Mapped[Optional["Job"]] = relationship()
