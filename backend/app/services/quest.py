"""
Career Quest — verifiable gamification, never fake.

Two rules:
  1. Points are only awarded for *verifiable* completed actions already in the
     user's real data (projects, resumes, interviews, skills...).
  2. Awards are idempotent via a natural `ref` key, so re-running sync never
     double-counts the same action.

`quest.py` reconciles the ledger against the user's current data, awarding
anything new and never removing already-earned points.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from app.models.quest import QuestAward, QuestEvent
from app.models.user import User


# Fixed, transparent point values per verifiable action kind.
POINTS = {
    "profile_complete": 50,
    "skill_added": 5,
    "project_created": 20,
    "project_completed": 15,
    "resume_uploaded": 25,
    "interview_completed": 15,
    "coding_solved": 10,
    "aptitude_completed": 8,
    "roadmap_generated": 15,
    "certification_added": 10,
    "achievement_added": 10,
}


# Fair caps so a user can't inflate a single category.
MAX_AWARDS = {
    "skill_added": 10, "project_created": 6, "project_completed": 6,
    "resume_uploaded": 4, "interview_completed": 12, "coding_solved": 20,
    "aptitude_completed": 12, "roadmap_generated": 4,
    "certification_added": 8, "achievement_added": 8,
}


# Badge thresholds on total points. Cosmetic recognition of real work.
BADGES = [
    {"id": "starter", "name": "Getting Started", "points": 25,
     "desc": "Earned first points for a real action."},
    {"id": "builder", "name": "Builder", "points": 100,
     "desc": "Built real portfolio and profile momentum."},
    {"id": "practitioner", "name": "Practitioner", "points": 250,
     "desc": "Consistent practice across projects and interviews."},
    {"id": "achiever", "name": "Achiever", "points": 500,
     "desc": "Sustained, verified career growth."},
    {"id": "champion", "name": "Champion", "points": 1000,
     "desc": "Outstanding career development."},
]

LEVELS = [
    {"level": 1, "points": 0, "title": "Explorer"},
    {"level": 2, "points": 50, "title": "Apprentice"},
    {"level": 3, "points": 150, "title": "Specialist"},
    {"level": 4, "points": 300, "title": "Strategist"},
    {"level": 5, "points": 600, "title": "Master"},
    {"level": 6, "points": 1000, "title": "Legend"},
]


def _today() -> date:
    return date.today()


def _award(db, user: User, kind: str, ref: str, label: str | None = None) -> bool:
    """Idempotently award points for one verifiable action. True if new."""
    exists = (
        db.query(QuestEvent)
        .filter(QuestEvent.user_id == user.id, QuestEvent.ref == ref)
        .first()
    )
    if exists is not None:
        return False

    cap = MAX_AWARDS.get(kind)
    if cap is not None:
        count = (
            db.query(QuestAward)
            .filter(QuestAward.user_id == user.id, QuestAward.kind == kind)
            .count()
        )
        if count >= cap:
            return False

    pt = POINTS.get(kind, 0)
    db.add(QuestEvent(user_id=user.id, kind=kind, points=pt,
                      ref=ref, label=(label or kind)[:200], day=_today()))
    db.add(QuestAward(user_id=user.id, kind=kind, ref=ref, points=pt))
    return True

def sync_quest(user: User, db) -> int:
    """Reconcile the ledger against real data. Returns count of NEW awards."""
    new_awards = 0

    # Profile completeness (a real, verifiable signal).
    profile = getattr(user, "profile", None)
    profile_ready = bool(
        getattr(user, "about", None)
        or getattr(profile, "about", None)
    ) and len(list(getattr(user, "skills", []))) > 0
    if profile_ready and _award(db, user, "profile_complete", "profile:complete",
                                 "Completed profile"):
        new_awards += 1

    # Skills
    for s in list(getattr(user, "skills", [])):
        if _award(db, user, "skill_added", f"skill:{s.id}", f"Skill: {s.name}"):
            new_awards += 1

    # Projects
    for p in list(getattr(user, "projects", [])):
        if _award(db, user, "project_created", f"project:{p.id}",
                  f"Project: {p.title}"):
            new_awards += 1
        if getattr(p, "status", "") == "completed":
            if _award(db, user, "project_completed", f"project_done:{p.id}",
                      f"Completed project: {p.title}"):
                new_awards += 1

    # Resumes
    for r in list(getattr(user, "resumes", [])):
        if _award(db, user, "resume_uploaded", f"resume:{r.id}",
                  "Resume uploaded"):
            new_awards += 1

    # Interviews (verifiable completed sessions)
    for iv in list(getattr(user, "interviews", [])):
        if getattr(iv, "status", "") in ("completed", "finished"):
            if _award(db, user, "interview_completed", f"interview:{iv.id}",
                      "Interview session"):
                new_awards += 1

    # Coding attempts that were passed
    for ca in list(getattr(user, "coding_attempts", [])):
        if getattr(ca, "passed", False) or getattr(ca, "status", "") == "passed":
            if _award(db, user, "coding_solved", f"coding:{ca.id}",
                      "Coding problem solved"):
                new_awards += 1

    # Certifications & achievements
    for c in list(getattr(user, "certifications", [])):
        if _award(db, user, "certification_added", f"cert:{c.id}",
                  f"Cert: {c.name}"):
            new_awards += 1
    for a in list(getattr(user, "achievements", [])):
        if _award(db, user, "achievement_added",
                  f"ach:{a.id}", f"Achievement: {a.title}"):
            new_awards += 1

    # Roadmaps
    for rm in list(getattr(user, "roadmaps", [])):
        if _award(db, user, "roadmap_generated", f"roadmap:{rm.id}",
                  "Roadmap generated"):
            new_awards += 1

    if new_awards:
        db.commit()
    return new_awards


def total_points(events: list[QuestEvent]) -> int:
    return sum(int(e.points) for e in events)


def level_for(points: int) -> dict:
    """Return the current level plus progress toward the next one."""
    current = LEVELS[0]
    nxt = None
    for i, lv in enumerate(LEVELS):
        if points >= lv["points"]:
            current = lv
            nxt = LEVELS[i + 1] if i + 1 < len(LEVELS) else None
        else:
            nxt = lv
            break
    if nxt is None:
        progress = 100
    else:
        span = nxt["points"] - current["points"]
        done = points - current["points"]
        progress = int(round((done / span) * 100)) if span > 0 else 100
    return {
        "level": current["level"],
        "title": current["title"],
        "points": points,
        "next_level": nxt["level"] if nxt else None,
        "next_title": nxt["title"] if nxt else None,
        "next_points": nxt["points"] if nxt else None,
        "progress_to_next": max(0, min(100, progress)),
    }


def badges_for(points: int) -> dict:
    earned = [b for b in BADGES if points >= b["points"]]
    earned_ids = {b["id"] for b in earned}
    upcoming = [
        {**b, "remaining": b["points"] - points}
        for b in BADGES if b["id"] not in earned_ids
    ][:3]
    return {
        "earned": earned,
        "upcoming": upcoming,
        "total_badges": len(BADGES),
    }


def events_out(events: list[QuestEvent]) -> list[dict]:
    """Recent ledger entries, newest first, grouped per calendar day."""
    ordered = sorted(events, key=lambda e: e.created_at, reverse=True)
    return [
        {
            "id": e.id,
            "kind": e.kind,
            "points": e.points,
            "label": e.label,
            "day": e.day.isoformat(),
            "created_at": e.created_at.isoformat(),
        }
        for e in ordered[:50]
    ]


def timeline(events: list[QuestEvent]) -> list[dict]:
    """Points per calendar day (oldest to newest) for the progress timeline."""
    by_day: dict[str, int] = {}
    for e in events:
        key = e.day.isoformat()
        by_day[key] = by_day.get(key, 0) + int(e.points)
    return [
        {"day": day, "points": by_day[day]}
        for day in sorted(by_day.keys())
    ]


def summary(user: User, events: list[QuestEvent]) -> dict[str, Any]:
    points = total_points(events)
    return {
        "points": points,
        "level": level_for(points),
        "badges": badges_for(points),
        "events": events_out(events),
        "timeline": timeline(events),
        "note": (
            "Points reflect real, verifiable actions only. Each action is counted "
            "once — duplicate or unverified submissions earn nothing."
        ),
    }
