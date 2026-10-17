"""Career Quest API — verifiable gamification, synced server-side.

GET  /quest          → sync the ledger against real data, then return the summary.
                       Syncing is idempotent: repeated calls never double-count.
"""
from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.models.quest import QuestEvent
from app.services import quest as quest_service

router = APIRouter(prefix="/quest", tags=["career-quest"])


@router.get("")
def get_quest(user: CurrentUser, db: DbSession):
    # 1) Reconcile the ledger with the user's real, verifiable data.
    new_awards = quest_service.sync_quest(user, db)
    # 2) Refresh relationships so counts reflect anything just added.
    db.refresh(user)
    events = (
        db.query(QuestEvent)
        .filter(QuestEvent.user_id == user.id)
        .order_by(QuestEvent.created_at.asc())
        .all()
    )
    result = quest_service.summary(user, events)
    result["new_awards"] = new_awards
    return result
