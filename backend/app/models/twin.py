"""AI Career Twin: a living, consent-gated profile the user fully controls.

The Twin is a *derived, editable* view over the user's own data (skills,
interests, education, experience, work style, goals) plus explicit consent
flags. The user can edit, export and delete it at any time. Personalization
only ever runs when consent is on; when consent is off the platform falls back
to generic, non-personalized suggestions.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base


class CareerTwin(Base):
    """One-per-user career twin with consent + snapshot history."""

    __tablename__ = "career_twins"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )

    # Editable twin inputs (mirrors the profile but is explicitly user-owned).
    work_style: Mapped[Optional[str]] = mapped_column(String(30))  # remote/hybrid/onsite
    experience_level: Mapped[Optional[str]] = mapped_column(String(30))  # fresher/junior/mid/senior
    primary_goal: Mapped[Optional[str]] = mapped_column(String(200))
    strengths: Mapped[str] = mapped_column(Text, default="[]")   # JSON list
    interests: Mapped[str] = mapped_column(Text, default="[]")   # JSON list
    focus_areas: Mapped[str] = mapped_column(Text, default="[]")  # JSON list

    # Consent & privacy. All default to False (privacy-preserving).
    personalization_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    analytics_consent: Mapped[bool] = mapped_column(Boolean, default=False)

    # Latest computed snapshot (JSON) so the UI can render instantly without
    # recomputing. Never contains secrets.
    snapshot: Mapped[str] = mapped_column(Text, default="{}")
    snapshot_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0-100 readiness
    snapshot_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="career_twin")


class TwinSnapshot(Base):
    """Point-in-time history of twin readiness, for the progress chart."""

    __tablename__ = "twin_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    score: Mapped[Float] = mapped_column(Float, default=0.0)
    skills_count: Mapped[Integer] = mapped_column(Integer, default=0)
    projects_count: Mapped[Integer] = mapped_column(Integer, default=0)
    interviews_count: Mapped[Integer] = mapped_column(Integer, default=0)
    note: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), index=True
    )

    user: Mapped["User"] = relationship(back_populates="twin_snapshots")
