"""Dashboard + career-readiness endpoints."""
from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.schemas import DashboardResponse
from app.services.readiness import readiness_for_user

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard(user: CurrentUser, db: DbSession):
    return readiness_for_user(db, user)


@router.get("/readiness")
def readiness(user: CurrentUser, db: DbSession):
    data = readiness_for_user(db, user)
    return {"score": data["career_readiness"], "breakdown": data["breakdown"],
            "next_actions": data["next_actions"]}
