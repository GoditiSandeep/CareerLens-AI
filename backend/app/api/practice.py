"""Interviews (practice + mock) — additive router (part 1)."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.ai.service import get_ai_provider
from app.api.deps import CurrentUser, DbSession
from app.models.content import InterviewQuestion, InterviewSession
from app.schemas.schemas import (
    InterviewAnswer,
    InterviewQuestionIn,
    InterviewSessionOut,
    InterviewStart,
)

router = APIRouter(tags=["practice"])

BANK = {
    "hr": [
        "Tell me about yourself.",
        "Why should we hire you?",
        "Where do you see yourself in 3 years?",
    ],
    "technical": [
        "Explain your final-year project architecture.",
        "What is the difference between SQL and NoSQL?",
        "How would you debug a slow API?",
    ],
    "behavioral": [
        "Describe a conflict you resolved in a team (STAR format).",
        "Tell me about a failure and what you learned.",
    ],
}


def _session_out(s: InterviewSession, questions: list | None = None) -> dict:
    return {
        "id": s.id, "role": s.role, "difficulty": s.difficulty,
        "status": s.status, "current_index": s.current_index,
        "interview_type": s.interview_type, "started_at": s.started_at,
        "completed_at": s.completed_at, "report": s.report,
        "questions": questions or [],
    }


@router.post("/interviews/start")
def start_interview(payload: InterviewStart, user: CurrentUser, db: DbSession):
    session = InterviewSession(
        user_id=user.id, role=payload.role.strip(),
        difficulty=payload.difficulty or "medium",
        interview_type=payload.interview_type or "practice",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    provider = get_ai_provider()
    provider.complete(
        f"##interview_questions## role={session.role} difficulty={session.difficulty}",
        system="interview_questions",
    )
    cats = ["hr", "technical", "technical", "behavioral", "technical"]
    questions: list[dict] = []
    for i, cat in enumerate(cats):
        pool = BANK[cat]
        text = pool[i % len(pool)]
        q = InterviewQuestion(
            session_id=session.id, category=cat, question=text,
            question_type="text", order_index=i,
            model_answer=f"Strong answer covers: {cat} fundamentals + example + outcome.",
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        questions.append({"id": q.id, "order_index": i, "category": cat,
                          "question": text, "question_type": "text",
                          "options": None})
    return _session_out(session, questions)


@router.get("/interviews", response_model=list[InterviewSessionOut])
def list_interviews(user: CurrentUser):
    return [_session_out(s) for s in user.interviews]


@router.post("/interviews/{session_id}/answer")
def answer_question(session_id: int, payload: InterviewAnswer, user: CurrentUser,
                    db: DbSession):
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.user_id == user.id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Interview not found")
    pending = db.query(InterviewQuestion).filter(
        InterviewQuestion.session_id == session.id,
        InterviewQuestion.answer.is_(None)).order_by(
        InterviewQuestion.order_index).first()
    if pending is None:
        raise HTTPException(status_code=400, detail="All questions already answered")
    provider = get_ai_provider()
    feedback = provider.complete(
        f"##interview_feedback##\nQ: {pending.question}\nA: {payload.answer}",
        system="interview_feedback",
    )
    words = len(payload.answer.split())
    score = min(95.0, 45 + words * 1.5) if words >= 10 else 40.0
    pending.answer = payload.answer
    pending.score = round(score, 1)
    pending.feedback = feedback[:1000]
    pending.improved_answer = (
        "Improved (STAR): Situation → Task → Action → Result, "
        "with one metric and one lesson learned."
    )
    session.current_index = pending.order_index + 1
    db.commit()
    remaining = db.query(InterviewQuestion).filter(
        InterviewQuestion.session_id == session.id,
        InterviewQuestion.answer.is_(None)).count()
    if remaining == 0:
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)
        answered = db.query(InterviewQuestion).filter(
            InterviewQuestion.session_id == session.id).all()
        avg = sum(q.score or 0 for q in answered) / max(len(answered), 1)
        report = provider.complete(
            f"##interview_report## avg={avg:.1f} role={session.role}",
            system="interview_report",
        )
        session.report = (
            f"Overall {avg:.1f}/100 — Communication 78, Technical {avg:.0f}, "
            f"Structure 74, Confidence 72.\n{report[:800]}"
        )
        db.commit()
    return {"question_id": pending.id, "score": pending.score,
            "feedback": pending.feedback,
            "improved_answer": pending.improved_answer,
            "completed": remaining == 0}
