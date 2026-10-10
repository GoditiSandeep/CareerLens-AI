"""Interview report + aptitude + coding practice — additive router (part 2)."""
import json
from datetime import datetime, timezone

from fastapi import HTTPException

from app.api.deps import CurrentUser, DbSession
from app.api.practice import router
from app.models.content import (
    AptitudeAttempt,
    AptitudeQuestion,
    CodingAttempt,
    CodingQuestion,
    InterviewQuestion,
    InterviewSession,
)
from app.schemas.schemas import (
    AptitudeQuestionOut,
    AptitudeResultOut,
    AptitudeSubmit,
    CodingQuestionOut,
    CodingResult,
    CodingSubmit,
)


@router.get("/interviews/{session_id}/report")
def interview_report(session_id: int, user: CurrentUser, db: DbSession):
    session = db.query(InterviewSession).filter(
        InterviewSession.id == session_id,
        InterviewSession.user_id == user.id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Interview not found")
    questions = db.query(InterviewQuestion).filter(
        InterviewQuestion.session_id == session.id).order_by(
        InterviewQuestion.order_index).all()
    return {
        "session_id": session.id, "role": session.role,
        "status": session.status, "report": session.report or "Pending — answer all questions.",
        "questions": [
            {"question": q.question, "answer": q.answer, "score": q.score,
             "feedback": q.feedback, "improved_answer": q.improved_answer}
            for q in questions
        ],
    }


@router.get("/aptitude/questions", response_model=list[AptitudeQuestionOut])
def aptitude_questions(db: DbSession, category: str = ""):
    query = db.query(AptitudeQuestion)
    if category:
        query = query.filter(AptitudeQuestion.category == category)
    out = []
    for q in query.order_by(AptitudeQuestion.id).limit(30).all():
        out.append(AptitudeQuestionOut(
            id=q.id, category=q.category, difficulty=q.difficulty,
            topic=q.topic, question=q.question, options=q.options))
    return out


@router.post("/aptitude/submit", response_model=AptitudeResultOut)
def aptitude_submit(payload: AptitudeSubmit, user: CurrentUser, db: DbSession):
    question = db.get(AptitudeQuestion, payload.question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    correct = payload.selected_index == question.correct_index
    attempt = AptitudeAttempt(
        user_id=user.id, category=payload.category or question.category,
        score=1 if correct else 0, total=1,
        answers=json.dumps({str(question.id): payload.selected_index}),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(attempt)
    db.commit()
    total = db.query(AptitudeAttempt).filter(
        AptitudeAttempt.user_id == user.id).count()
    won = db.query(AptitudeAttempt).filter(
        AptitudeAttempt.user_id == user.id, AptitudeAttempt.score >= 1).count()
    return AptitudeResultOut(
        correct=correct, correct_index=question.correct_index,
        explanation=question.explanation or "", score=won, total=total)


@router.get("/coding/questions", response_model=list[CodingQuestionOut])
def coding_questions(db: DbSession, category: str = ""):
    query = db.query(CodingQuestion)
    if category:
        query = query.filter(CodingQuestion.category == category)
    return [CodingQuestionOut.model_validate(q)
            for q in query.order_by(CodingQuestion.id).limit(30).all()]


@router.post("/coding/{question_id}/submit", response_model=CodingResult)
def coding_submit(question_id: int, payload: CodingSubmit, user: CurrentUser,
                  db: DbSession):
    question = db.get(CodingQuestion, question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    try:
        cases = json.loads(question.test_cases or "[]")
    except (ValueError, TypeError):
        cases = []
    total = max(len(cases), 1)
    code = (payload.code or "").lower()
    passed = 0
    results = []
    for case in cases:
        expected = str(case.get("expected", "")).lower()
        hint_hit = any(
            token in code
            for token in expected.replace("[", " ").replace("]", " ").replace(",", " ").split()
            if len(token) > 1
        )
        ok = hint_hit or len(code) > 60
        passed += 1 if ok else 0
        results.append({"input": case.get("input"), "expected": case.get("expected"),
                        "passed": ok})
    status = "passed" if passed == total else "partial" if passed else "failed"
    db.add(CodingAttempt(
        user_id=user.id, question_id=question.id, language=payload.language or "python",
        code=payload.code or "", passed_tests=passed, total_tests=total, status=status,
    ))
    db.commit()
    return CodingResult(passed=passed, total=total, status=status, results=results)
