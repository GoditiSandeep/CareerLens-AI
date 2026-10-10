"""Learning roadmap generation + tracking."""
import json
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from app.ai.service import get_ai_provider
from app.api.deps import CurrentUser, DbSession
from app.models.career import CareerPath, Roadmap, RoadmapItem
from app.schemas.schemas import (
    RoadmapGenerateRequest,
    RoadmapItemOut,
    RoadmapItemUpdate,
    RoadmapOut,
)

router = APIRouter(tags=["roadmap"])

MONTH_TITLES = [
    "Foundations", "Core skills", "Applied practice",
    "Projects", "Advanced topics", "Interview preparation",
]


def _out(roadmap: Roadmap, db) -> RoadmapOut:
    items = db.query(RoadmapItem).filter(
        RoadmapItem.roadmap_id == roadmap.id).order_by(
        RoadmapItem.month, RoadmapItem.order_index).all()
    return RoadmapOut(
        id=roadmap.id, career_path_name=roadmap.career_path_name,
        title=roadmap.title, total_months=roadmap.total_months,
        progress=roadmap.progress, generated_at=roadmap.generated_at,
        items=[RoadmapItemOut.model_validate(i) for i in items],
    )


@router.get("/roadmap", response_model=list[RoadmapOut])
def list_roadmaps(user: CurrentUser, db: DbSession):
    return [_out(r, db) for r in
            db.query(Roadmap).filter(Roadmap.user_id == user.id).all()]


@router.post("/roadmap/generate", response_model=RoadmapOut, status_code=201)
def generate_roadmap(payload: RoadmapGenerateRequest, user: CurrentUser, db: DbSession):
    career = db.query(CareerPath).filter(
        CareerPath.name == payload.target_role).first()
    months = payload.months or 6
    provider = get_ai_provider()
    provider.complete(f"##roadmap## target={payload.target_role} months={months}",
                      system="roadmap generator")
    base_topics: list[str] = []
    if career:
        try:
            base_topics = list(json.loads(career.interview_topics or "[]"))[:6]
        except (ValueError, TypeError):
            base_topics = []
    roadmap = Roadmap(user_id=user.id, career_path_name=payload.target_role,
                      title=f"{payload.target_role} — {months}-month plan",
                      total_months=months)
    db.add(roadmap)
    db.commit()
    db.refresh(roadmap)
    start = date.today()
    for m in range(1, months + 1):
        title = MONTH_TITLES[(m - 1) % len(MONTH_TITLES)]
        topic = f" — focus: {base_topics[(m - 1) % len(base_topics)]}" if base_topics else ""
        db.add(RoadmapItem(
            roadmap_id=roadmap.id, month=m,
            title=f"Month {m}: {title}{topic}",
            description=f"Weekly goals for {title.lower()} plus one portfolio artifact.",
            category="learning",
            deadline=start + timedelta(days=30 * m),
            resources=json.dumps(["Official docs", "One guided course", "Practice set"]),
            order_index=m,
        ))
    db.commit()
    return _out(roadmap, db)


@router.put("/roadmap/items/{item_id}", response_model=RoadmapItemOut)
def update_item(item_id: int, payload: RoadmapItemUpdate, user: CurrentUser, db: DbSession):
    item = db.query(RoadmapItem).join(Roadmap).filter(
        RoadmapItem.id == item_id, Roadmap.user_id == user.id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    if payload.status is not None:
        item.status = payload.status
    if payload.notes is not None:
        item.notes = payload.notes
    if payload.deadline is not None:
        item.deadline = payload.deadline
    db.commit()
    siblings = db.query(RoadmapItem).filter(
        RoadmapItem.roadmap_id == item.roadmap_id).all()
    done = sum(1 for s in siblings if s.status == "completed")
    roadmap = db.get(Roadmap, item.roadmap_id)
    roadmap.progress = round(done / max(len(siblings), 1) * 100, 1)
    db.commit()
    db.refresh(item)
    return RoadmapItemOut.model_validate(item)
