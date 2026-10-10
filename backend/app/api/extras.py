"""Projects, achievements, certifications — additive router (part 1)."""
import json

from fastapi import APIRouter, HTTPException

from app.ai.service import get_ai_provider
from app.api.deps import CurrentUser, DbSession
from app.models.content import Achievement, Certification, UserProject
from app.schemas.schemas import (
    AchievementCreate,
    AchievementOut,
    CertificationCreate,
    CertificationOut,
    ProjectOut,
    UserProjectCreate,
    UserProjectOut,
)

router = APIRouter(tags=["extras"])


def _tech_list(raw: str) -> list[str]:
    try:
        parsed = json.loads(raw or "[]")
        return parsed if isinstance(parsed, list) else []
    except (ValueError, TypeError):
        return []


@router.get("/projects/recommendations", response_model=list[ProjectOut])
def project_recommendations(user: CurrentUser, db: DbSession):
    from app.seed.projects_extra import MORE_PROJECTS

    provider = get_ai_provider()
    provider.complete(
        f"##project_recommendations## skills={[s.name for s in user.skills][:10]}",
        system="project_recommendations",
    )
    mine = {s.name.lower() for s in user.skills}
    ranked = sorted(
        MORE_PROJECTS,
        key=lambda p: len(mine & {t.lower() for t in p.get("technologies", [])}),
        reverse=True,
    )
    return [ProjectOut(**p) for p in ranked]


@router.get("/projects/mine", response_model=list[UserProjectOut])
def my_projects(user: CurrentUser):
    return [
        UserProjectOut(
            id=p.id, title=p.title, description=p.description or "",
            technologies=_tech_list(p.technologies), category=p.category,
            difficulty=p.difficulty, github_url=p.github_url,
            status=p.status, created_at=p.created_at,
        )
        for p in user.projects
    ]


@router.post("/projects/mine", response_model=UserProjectOut, status_code=201)
def create_user_project(payload: UserProjectCreate, user: CurrentUser, db: DbSession):
    project = UserProject(
        user_id=user.id, title=payload.title.strip(),
        description=payload.description or "",
        technologies=json.dumps(payload.technologies or []),
        category=payload.category or "web",
        difficulty=payload.difficulty or "Beginner",
        github_url=payload.github_url, status=payload.status or "planned",
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return UserProjectOut(
        id=project.id, title=project.title, description=project.description or "",
        technologies=_tech_list(project.technologies), category=project.category,
        difficulty=project.difficulty, github_url=project.github_url,
        status=project.status, created_at=project.created_at,
    )
