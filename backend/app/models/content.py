"""Achievements, certifications, user projects, chat + interview/aptitude/coding content."""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.db import Base


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    achievement_type: Mapped[str] = mapped_column(
        String(40)
    )  # certification/hackathon/competition/internship/award/publication/project/extracurricular
    organization: Mapped[Optional[str]] = mapped_column(String(200))
    date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    description: Mapped[Optional[str]] = mapped_column(Text)
    url: Mapped[Optional[str]] = mapped_column(String(500))

    user: Mapped["User"] = relationship(back_populates="achievements")


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    issuer: Mapped[Optional[str]] = mapped_column(String(200))
    issue_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    credential_url: Mapped[Optional[str]] = mapped_column(String(500))
    skills: Mapped[str] = mapped_column(Text, default="[]")  # JSON list

    user: Mapped["User"] = relationship(back_populates="certifications")


class UserProject(Base):
    __tablename__ = "user_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    technologies: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    category: Mapped[str] = mapped_column(String(60), default="web")
    difficulty: Mapped[str] = mapped_column(String(30), default="Beginner")
    github_url: Mapped[Optional[str]] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(30), default="planned")  # planned/inprogress/completed
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="projects")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20))  # user/assistant
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(150))
    difficulty: Mapped[str] = mapped_column(String(30), default="medium")
    interview_type: Mapped[str] = mapped_column(String(40), default="practice")
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="in_progress")
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    interview_type: Mapped[str] = mapped_column(String(30), default="practice")  # practice/mock
    started_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    report: Mapped[Optional[str]] = mapped_column(Text)  # JSON final report

    user: Mapped["User"] = relationship(back_populates="interviews")
    questions: Mapped[list["InterviewQuestion"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE")
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    category: Mapped[str] = mapped_column(String(60))  # hr/technical/behavioral/aptitude/coding/role
    question: Mapped[str] = mapped_column(Text)
    question_type: Mapped[str] = mapped_column(String(30), default="open")  # open/mcq/coding
    options: Mapped[Optional[str]] = mapped_column(Text)  # JSON for mcq
    correct_answer: Mapped[Optional[str]] = mapped_column(Text)  # for mcq/self-check
    answer: Mapped[Optional[str]] = mapped_column(Text)  # user's answer
    score: Mapped[Optional[float]] = mapped_column(Float)
    feedback: Mapped[Optional[str]] = mapped_column(Text)
    improved_answer: Mapped[Optional[str]] = mapped_column(Text)
    model_answer: Mapped[Optional[str]] = mapped_column(Text)

    session: Mapped["InterviewSession"] = relationship(back_populates="questions")


class AptitudeQuestion(Base):
    __tablename__ = "aptitude_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(60))  # quantitative/logical/verbal/di
    difficulty: Mapped[str] = mapped_column(String(30), default="easy")
    topic: Mapped[str] = mapped_column(String(80), default="")
    question: Mapped[str] = mapped_column(Text)
    options: Mapped[str] = mapped_column(Text)  # JSON list of 4 options
    correct_index: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(30), default="seed")


class AptitudeAttempt(Base):
    __tablename__ = "aptitude_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(60))
    score: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    answers: Mapped[str] = mapped_column(Text, default="{}")  # JSON {qid: chosen_index}
    started_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


class CodingQuestion(Base):
    __tablename__ = "coding_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(60))  # arrays/strings/linked_list/...
    difficulty: Mapped[str] = mapped_column(String(30), default="easy")
    title: Mapped[str] = mapped_column(String(200))
    statement: Mapped[str] = mapped_column(Text)
    examples: Mapped[str] = mapped_column(Text, default="[]")  # JSON
    constraints: Mapped[Optional[str]] = mapped_column(Text)
    starter_code: Mapped[Optional[str]] = mapped_column(Text)
    test_cases: Mapped[str] = mapped_column(Text, default="[]")  # JSON [{input, expected, hidden}]
    explanation: Mapped[Optional[str]] = mapped_column(Text)


class CodingAttempt(Base):
    __tablename__ = "coding_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    question_id: Mapped[int] = mapped_column(
        ForeignKey("coding_questions.id", ondelete="CASCADE")
    )
    language: Mapped[str] = mapped_column(String(30), default="python")
    code: Mapped[str] = mapped_column(Text)
    passed_tests: Mapped[int] = mapped_column(Integer, default=0)
    total_tests: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="not_run")  # not_run/passed/failed
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="coding_attempts")
    question: Mapped["CodingQuestion"] = relationship()
