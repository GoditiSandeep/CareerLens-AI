"""Career Quest gamification: a verifiable points ledger + earned badges.

Design principle — NO fake progress:
  * Points are only ever awarded by the backend for *verifiable* completed
    actions (a real project created, a real resume uploaded, a real interview
    finished, a real skill added, etc.).
  * Every award is written to the ledger with a natural idempotency key so the
    same action can never be double-counted.
  * Badges are unlocked from the ledger totals; the frontend only displays what
    the server computed.
"""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base

# Verifiable action kinds the ledger understands. Each maps to a fixed point
# value in quest.py so scoring is transparent and auditable.
ACTION_KINDS = (
    "profile_complete",
    "skill_added",
    "project_created",
    "project_completed",
    "resume_uploaded",
    "interview_completed",
    "coding_solved",
    "aptitude_completed",
    "roadmap_generated",
    "certification_added",
    "achievement_added",
)


class QuestEvent(Base):
    """One verifiable, point-awarding action.

    `ref` is a stable natural key (e.g. ``project:12``) that makes awards
    idempotent: awarding the same ref twice is ignored by the service.
    """

    __tablename__ = "quest_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40), index=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
    ref: Mapped[str] = mapped_column(String(120), index=True)  # idempotency key
    label: Mapped[Optional[str]] = mapped_column(String(200))
    day: Mapped[date] = mapped_column(Date)  # local calendar day of the action
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="quest_events")


class QuestAward(Base):
    """Idempotent record of an awarded action, used to enforce per-kind caps.

    `ref` is a stable natural key (the same idempotency key used on the
    corresponding ``QuestEvent``) so each verifiable action is counted only
    once for its kind.
    """

    __tablename__ = "quest_awards"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(40), index=True)
    ref: Mapped[str] = mapped_column(String(120), index=True)
    points: Mapped[int] = mapped_column(Integer, default=0)
