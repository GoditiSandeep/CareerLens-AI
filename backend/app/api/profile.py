"""Profile + onboarding routes."""
import json

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.models.career import StudentSkill
from app.models.user import StudentProfile
from app.schemas.schemas import (
    OnboardingComplete,
    ProfileUpdate,
    StudentProfileOut,
)

router = APIRouter(prefix="/profile", tags=["profile"])


def _to_list(value: str | None) -> list[str] | None:
    if not value:
        return None
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else None
    except (ValueError, TypeError):
        return None


@router.get("", response_model=StudentProfileOut)
def get_profile(user: CurrentUser, db: DbSession):
    profile = db.query(StudentProfile).filter(
        StudentProfile.user_id == user.id).first()
    if profile is None:
        profile = StudentProfile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("", response_model=StudentProfileOut)
def update_profile(payload: ProfileUpdate, user: CurrentUser, db: DbSession):
    profile = db.query(StudentProfile).filter(
        StudentProfile.user_id == user.id).first()
    if profile is None:
        profile = StudentProfile(user_id=user.id)
        db.add(profile)
    data = payload.model_dump(exclude_unset=True)
    list_fields = {"subjects", "desired_roles", "industries", "preferred_locations",
                   "target_companies", "strengths", "interests"}
    for key, value in data.items():
        if key in list_fields:
            setattr(profile, key, json.dumps(value) if value is not None else None)
        else:
            setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/onboarding", response_model=StudentProfileOut)
def complete_onboarding(payload: OnboardingComplete, user: CurrentUser, db: DbSession):
    profile = db.query(StudentProfile).filter(
        StudentProfile.user_id == user.id).first()
    if profile is None:
        profile = StudentProfile(user_id=user.id)
        db.add(profile)
    for field in ("desired_roles", "industries", "preferred_locations",
                  "target_companies"):
        value = getattr(payload, field)
        if value is not None:
            setattr(profile, field, json.dumps(value))
    if payload.work_preference is not None:
        profile.work_preference = payload.work_preference
    if payload.salary_expectation is not None:
        profile.salary_expectation = payload.salary_expectation
    for item in payload.skills:
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        level = float(item.get("level", 50))
        existing = db.query(StudentSkill).filter(
            StudentSkill.user_id == user.id,
            StudentSkill.name == name).first()
        if existing:
            existing.level = level
            if item.get("category"):
                existing.category = str(item["category"])
        else:
            db.add(StudentSkill(
                user_id=user.id, name=name,
                category=str(item.get("category", "technical")), level=level,
                target_level=float(item.get("target_level", 80))))
    profile.onboarding_completed = True
    profile.onboarding_step = 5
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/export")
def export_profile(user: CurrentUser, db: DbSession):
    """Share-ready profile snapshot (JSON)."""
    profile = db.query(StudentProfile).filter(
        StudentProfile.user_id == user.id).first()
    return {
        "name": user.full_name, "email": user.email,
        "college": profile.college if profile else None,
        "degree": profile.degree if profile else None,
        "branch": profile.branch if profile else None,
        "about": profile.about if profile else None,
        "skills": [{"name": s.name, "level": s.level, "category": s.category}
                   for s in user.skills],
        "projects": [{"title": p.title, "technologies": json.loads(p.technologies),
                      "status": p.status} for p in user.projects],
        "certifications": [{"name": c.name, "issuer": c.issuer} for c in user.certifications],
        "achievements": [{"title": a.title, "type": a.achievement_type} for a in user.achievements],
        "career_goals": profile.career_goals if profile else None,
        "desired_roles": _to_list(profile.desired_roles) if profile else None,
    }
