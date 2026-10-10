"""Career discovery + skill-gap endpoints."""
import json

from fastapi import APIRouter, HTTPException

from app.ai.service import get_ai_provider
from app.api.deps import CurrentUser, DbSession
from app.models.career import CareerPath, Skill, StudentSkill
from app.schemas.schemas import (
    CareerRecommendationOut,
    SkillGapOut,
    SkillOut,
)
from app.services.scoring import job_match_score, skill_gaps

router = APIRouter(tags=["careers"])


def _career_out(c: CareerPath) -> dict:
    return {
        "id": c.id, "name": c.name, "category": c.category,
        "description": c.description,
        "required_skills": json.loads(c.required_skills or "[]"),
        "responsibilities": json.loads(c.responsibilities or "[]"),
        "roadmap": json.loads(c.roadmap or "[]"),
        "projects": json.loads(c.projects or "[]"),
        "interview_topics": json.loads(c.interview_topics or "[]"),
        "certifications": json.loads(c.certifications or "[]"),
        "salary_range": c.salary_range, "demand_level": c.demand_level,
    }


@router.get("/careers", response_model=list[CareerRecommendationOut])
def list_careers(db: DbSession):
    return [_career_out(c) for c in db.query(CareerPath).all()]


@router.get("/careers/recommendations", response_model=list[CareerRecommendationOut])
def recommend_careers(user: CurrentUser, db: DbSession):
    mine = {s.name.lower() for s in user.skills}
    scored = []
    for c in db.query(CareerPath).all():
        try:
            req = json.loads(c.required_skills or "[]")
            req_list = list(req.keys()) if isinstance(req, dict) else list(req)
        except (ValueError, TypeError):
            req_list = []
        score = job_match_score(mine, req_list)
        out = _career_out(c)
        out["suitability"] = score
        scored.append(out)
    scored.sort(key=lambda x: x.get("suitability", 0), reverse=True)
    provider = get_ai_provider()
    provider.complete(f"##recommendations## skills={sorted(mine)[:12]}",
                      system="career_recommendations")
    return scored[:10]


@router.get("/skills", response_model=list[SkillOut])
def list_skills(db: DbSession):
    return db.query(Skill).all()


@router.get("/skills/mine")
def my_skills(user: CurrentUser):
    return [{"id": s.id, "name": s.name, "level": s.level,
             "target_level": s.target_level, "category": s.category}
            for s in user.skills]


@router.post("/skills")
def upsert_skill(payload: dict, user: CurrentUser, db: DbSession):
    name = str(payload.get("name", "")).strip()
    if not name:
        raise HTTPException(status_code=400, detail="Skill name required")
    existing = db.query(StudentSkill).filter(
        StudentSkill.user_id == user.id, StudentSkill.name == name).first()
    if existing:
        existing.level = float(payload.get("level", existing.level))
        existing.target_level = float(payload.get("target_level", existing.target_level))
        if payload.get("category"):
            existing.category = str(payload["category"])
        db.commit()
        return {"updated": name}
    db.add(StudentSkill(
        user_id=user.id, name=name,
        category=str(payload.get("category", "technical")),
        level=float(payload.get("level", 50)),
        target_level=float(payload.get("target_level", 80))))
    db.commit()
    return {"created": name}


@router.get("/skills/gaps", response_model=SkillGapOut)
def gaps(target: str, user: CurrentUser, db: DbSession):
    career = db.query(CareerPath).filter(CareerPath.name == target).first()
    if career is None:
        raise HTTPException(status_code=404, detail="Career path not found")
    mine = {s.name: s.level for s in user.skills}
    try:
        req = json.loads(career.required_skills or "[]")
    except (ValueError, TypeError):
        req = []
    gap_list = skill_gaps(mine, req)
    top = [g["name"] for g in gap_list[:3] if g["gap"] > 5]
    recs = [f"Prioritize {', '.join(top) or 'core fundamentals'} with 30 min daily practice."]
    recs.append("Build one portfolio project covering your top 2 gaps.")
    return SkillGapOut(target=target, gaps=gap_list, recommendations=recs)
