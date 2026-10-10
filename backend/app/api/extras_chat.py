"""Achievements, certifications, AI chat — additive router (part 2)."""
import json

from fastapi import HTTPException

from app.ai.service import get_ai_provider
from app.api.deps import CurrentUser, DbSession
from app.api.extras import _tech_list, router
from app.models.content import Achievement, Certification, ChatMessage
from app.schemas.schemas import (
    AchievementCreate,
    AchievementOut,
    CertificationCreate,
    CertificationOut,
    ChatHistoryOut,
    ChatRequest,
    ChatResponse,
)


@router.get("/achievements", response_model=list[AchievementOut])
def list_achievements(user: CurrentUser):
    return [AchievementOut.model_validate(a) for a in user.achievements]


@router.post("/achievements", response_model=AchievementOut, status_code=201)
def create_achievement(payload: AchievementCreate, user: CurrentUser, db: DbSession):
    achievement = Achievement(
        user_id=user.id, title=payload.title.strip(),
        achievement_type=payload.achievement_type or "award",
        organization=payload.organization, date=payload.date,
        description=payload.description, url=payload.url,
    )
    db.add(achievement)
    db.commit()
    db.refresh(achievement)
    return AchievementOut.model_validate(achievement)


@router.delete("/achievements/{achievement_id}")
def delete_achievement(achievement_id: int, user: CurrentUser, db: DbSession):
    achievement = db.query(Achievement).filter(
        Achievement.id == achievement_id, Achievement.user_id == user.id).first()
    if achievement is None:
        raise HTTPException(status_code=404, detail="Achievement not found")
    db.delete(achievement)
    db.commit()
    return {"deleted": achievement_id}


@router.get("/certifications", response_model=list[CertificationOut])
def list_certifications(user: CurrentUser):
    return [
        CertificationOut(
            id=c.id, name=c.name, issuer=c.issuer, issue_date=c.issue_date,
            credential_url=c.credential_url, skills=_tech_list(c.skills),
        )
        for c in user.certifications
    ]


@router.post("/certifications", response_model=CertificationOut, status_code=201)
def create_certification(payload: CertificationCreate, user: CurrentUser, db: DbSession):
    cert = Certification(
        user_id=user.id, name=payload.name.strip(), issuer=payload.issuer,
        issue_date=payload.issue_date, credential_url=payload.credential_url,
        skills=json.dumps(payload.skills or []),
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return CertificationOut(
        id=cert.id, name=cert.name, issuer=cert.issuer,
        issue_date=cert.issue_date, credential_url=cert.credential_url,
        skills=_tech_list(cert.skills),
    )


@router.post("/ai/chat", response_model=ChatResponse)
def ai_chat(payload: ChatRequest, user: CurrentUser, db: DbSession):
    profile = user.profile
    context = (
        f"Student {user.full_name} | branch={profile.branch if profile else '?'} | "
        f"skills={[s.name for s in user.skills][:10]} | "
        f"goals={(profile.career_goals if profile else '') or ''}"
    )
    provider = get_ai_provider()
    reply = provider.complete(
        f"##chat##\nContext: {context}\nQuestion: {payload.message}",
        system="CareerLens AI Assistant",
    )
    db.add(ChatMessage(user_id=user.id, role="user", content=payload.message))
    db.add(ChatMessage(user_id=user.id, role="assistant", content=reply))
    db.commit()
    return ChatResponse(reply=reply)


@router.get("/ai/chat/history", response_model=list[ChatHistoryOut])
def chat_history(user: CurrentUser, db: DbSession):
    messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == user.id).order_by(ChatMessage.created_at).all()
    return [ChatHistoryOut.model_validate(m) for m in messages[-50:]]
