"""AI Career Twin API — consent-gated, editable, exportable, deletable.

Endpoints:
  GET    /twin            → the user's twin (auto-created on first access)
  PUT    /twin            → update twin fields + consent
  POST   /twin/refresh    → recompute the explainable snapshot (+ history)
  GET    /twin/export     → portable JSON copy of all personal twin data
  DELETE /twin            → permanently delete twin + its snapshot history
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, DbSession
from app.models.twin import CareerTwin, TwinSnapshot
from app.schemas.schemas import CareerTwinOut, CareerTwinUpdate
from app.services import twin as twin_service

router = APIRouter(prefix="/twin", tags=["career-twin"])

_ALLOWED_WORK_STYLES = {"remote", "hybrid", "onsite", "flexible"}
_ALLOWED_LEVELS = {"fresher", "junior", "mid", "senior", "career-switcher"}


def _get_or_create_twin(user: CurrentUser, db: DbSession) -> CareerTwin:
    twin = db.query(CareerTwin).filter(CareerTwin.user_id == user.id).first()
    if twin is None:
        twin = CareerTwin(user_id=user.id)
        db.add(twin)
        db.commit()
        db.refresh(twin)
    return twin


def _dump_list(value) -> str:
    if isinstance(value, list):
        return json.dumps([str(v)[:80] for v in value][:20])
    return "[]"


def _load_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (ValueError, TypeError):
        return []


def _recompute(user: CurrentUser, db: DbSession, twin: CareerTwin, note: str | None = None) -> dict:
    """Recompute + persist the snapshot and append a history point."""
    snapshot = twin_service.build_snapshot(user)
    twin.snapshot = json.dumps(snapshot)
    twin.snapshot_score = float(snapshot["score"])
    twin.snapshot_at = datetime.now(timezone.utc)
    db.add(twin)
    db.add(TwinSnapshot(
        user_id=user.id,
        score=float(snapshot["score"]),
        skills_count=snapshot["signals"]["skills"]["count"],
        projects_count=snapshot["signals"]["projects"]["count"],
        interviews_count=snapshot["signals"]["interviews"]["count"],
        note=note,
    ))
    db.commit()
    db.refresh(twin)
    return snapshot


@router.get("", response_model=CareerTwinOut)
def get_twin(user: CurrentUser, db: DbSession):
    twin = _get_or_create_twin(user, db)
    # Ensure a snapshot exists so the UI always has something to render.
    if twin.snapshot_at is None:
        _recompute(user, db, twin, note="initial")
    return twin


@router.put("", response_model=CareerTwinOut)
def update_twin(payload: CareerTwinUpdate, user: CurrentUser, db: DbSession):
    twin = _get_or_create_twin(user, db)
    data = payload.model_dump(exclude_unset=True)

    if "work_style" in data and data["work_style"]:
        if data["work_style"] not in _ALLOWED_WORK_STYLES:
            raise HTTPException(
                status_code=400,
                detail=f"work_style must be one of {sorted(_ALLOWED_WORK_STYLES)}")
        twin.work_style = data["work_style"]
    if "experience_level" in data and data["experience_level"]:
        if data["experience_level"] not in _ALLOWED_LEVELS:
            raise HTTPException(
                status_code=400,
                detail=f"experience_level must be one of {sorted(_ALLOWED_LEVELS)}")
        twin.experience_level = data["experience_level"]

    if "primary_goal" in data and data["primary_goal"] is not None:
        twin.primary_goal = data["primary_goal"].strip()[:200] or None
    if "strengths" in data and data["strengths"] is not None:
        twin.strengths = _dump_list(data["strengths"])
    if "interests" in data and data["interests"] is not None:
        twin.interests = _dump_list(data["interests"])
    if "focus_areas" in data and data["focus_areas"] is not None:
        twin.focus_areas = _dump_list(data["focus_areas"])
    # Consent: only change when explicitly provided (never default-on).
    if "personalization_consent" in data and data["personalization_consent"] is not None:
        twin.personalization_consent = bool(data["personalization_consent"])
    if "analytics_consent" in data and data["analytics_consent"] is not None:
        twin.analytics_consent = bool(data["analytics_consent"])

    db.commit()
    db.refresh(twin)
    # Snapshot reflects latest editable inputs.
    _recompute(user, db, twin, note="updated")
    return twin


@router.post("/refresh")
def refresh_twin(user: CurrentUser, db: DbSession):
    twin = _get_or_create_twin(user, db)
    snapshot = _recompute(user, db, twin, note="manual refresh")
    return {"score": snapshot["score"], "snapshot": snapshot}


@router.get("/export")
def export_twin(user: CurrentUser, db: DbSession):
    """Portable JSON of ALL personal twin data the platform holds."""
    twin = _get_or_create_twin(user, db)
    history = (
        db.query(TwinSnapshot)
        .filter(TwinSnapshot.user_id == user.id)
        .order_by(TwinSnapshot.created_at.asc())
        .all()
    )
    return {
        "twin": {
            "work_style": twin.work_style,
            "experience_level": twin.experience_level,
            "primary_goal": twin.primary_goal,
            "strengths": _load_list(twin.strengths),
            "interests": _load_list(twin.interests),
            "focus_areas": _load_list(twin.focus_areas),
            "personalization_consent": twin.personalization_consent,
            "analytics_consent": twin.analytics_consent,
        },
        "skills": [
            {"name": s.name, "level": s.level, "target_level": s.target_level,
             "category": s.category}
            for s in user.skills
        ],
        "snapshot": json.loads(twin.snapshot or "{}"),
        "history": [
            {"score": h.score, "at": h.created_at.isoformat(), "note": h.note}
            for h in history
        ],
        "exported_at": twin.snapshot_at.isoformat() if twin.snapshot_at else None,
    }


@router.delete("")
def delete_twin(user: CurrentUser, db: DbSession) -> dict:
    """Permanently delete the twin and its snapshot history (data portability)."""
    twin = db.query(CareerTwin).filter(CareerTwin.user_id == user.id).first()
    if twin is not None:
        db.delete(twin)
    db.query(TwinSnapshot).filter(TwinSnapshot.user_id == user.id).delete()
    db.commit()
    return {"deleted": True}
