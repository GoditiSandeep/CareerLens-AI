"""AI Career Twin — transparent, explainable readiness scoring.

Readiness is a simple, explainable composite of observable signals so the user
can see exactly why they got each number. When consent is off the score still
computes but is not used for tailored suggestions.
"""
from __future__ import annotations

from typing import Any

from app.models.user import User


_WEIGHTS = {"skills": 30, "projects": 20, "resumes": 10, "interviews": 20, "profile": 20}


def _safe_get(obj: Any, attr: str, default: Any) -> Any:
    value = getattr(obj, attr, default)
    return default if value is None else value


def compute_signals(user: User) -> dict[str, dict]:
    """Per-signal detail with an earned value and human explanation."""
    skills = list(_safe_get(user, "skills", []))
    projects = list(_safe_get(user, "projects", []))
    resumes = list(_safe_get(user, "resumes", []))
    interviews = list(_safe_get(user, "interviews", []))

    avg_level = (sum(s.level for s in skills) / len(skills)) if skills else 0.0
    breadth = min(len(skills), 10) / 10
    skills_ratio = (0.5 * breadth + 0.5 * (avg_level / 100)) if skills else 0.0
    skills_earned = round(skills_ratio * _WEIGHTS["skills"], 1)

    projects_ratio = min(len(projects), 5) / 5
    projects_earned = round(projects_ratio * _WEIGHTS["projects"], 1)

    resumes_earned = _WEIGHTS["resumes"] if resumes else 0.0

    interviews_ratio = min(len(interviews), 8) / 8
    interviews_earned = round(interviews_ratio * _WEIGHTS["interviews"], 1)

    profile = getattr(user, "profile", None)
    twin = getattr(user, "career_twin", None)
    checks = 0
    total_checks = 6
    if getattr(user, "about", None) or getattr(profile, "about", None):
        checks += 1
    if getattr(profile, "college", None) or getattr(profile, "degree", None):
        checks += 1
    if skills:
        checks += 1
    if twin is not None and getattr(twin, "primary_goal", None):
        checks += 1
    if twin is not None and getattr(twin, "experience_level", None):
        checks += 1
    if projects:
        checks += 1
    profile_ratio = checks / total_checks
    profile_earned = round(profile_ratio * _WEIGHTS["profile"], 1)

    signals = {
        "skills": {
            "earned": skills_earned,
            "max": _WEIGHTS["skills"],
            "count": len(skills),
            "avg_level": round(avg_level, 1),
            "explanation": (
                f"{len(skills)} skill(s) logged, average level "
                f"{avg_level:.0f}/100."
            ),
        },
        "projects": {
            "earned": projects_earned,
            "max": _WEIGHTS["projects"],
            "count": len(projects),
            "explanation": f"{len(projects)} portfolio project(s) on record.",
        },
        "resumes": {
            "earned": resumes_earned,
            "max": _WEIGHTS["resumes"],
            "count": len(resumes),
            "explanation": "A resume has been uploaded." if resumes else "No resume yet.",
        },
        "interviews": {
            "earned": interviews_earned,
            "max": _WEIGHTS["interviews"],
            "count": len(interviews),
            "explanation": f"{len(interviews)} interview practice session(s) completed.",
        },
        "profile": {
            "earned": profile_earned,
            "max": _WEIGHTS["profile"],
            "count": checks,
            "of": total_checks,
            "explanation": f"Profile completeness {checks}/{total_checks}.",
        },
    }
    return signals


def readiness_score(signals: dict[str, dict]) -> float:
    """Weighted composite of per-signal earned values, normalized to 0..100."""
    total = 0.0
    for key, weight in _WEIGHTS.items():
        if key not in signals:
            continue
        earned = float(signals[key].get("earned", 0.0))
        max_val = float(signals[key].get("max", weight))
        if max_val > 0:
            total += earned / max_val * weight
    return round(total, 1)


def skill_breakdown(signals: dict[str, dict]) -> dict[str, dict]:
    """Ordered summary of each signal for the UI to display."""
    return {
        "skills": signals.get("skills", {}),
        "projects": signals.get("projects", {}),
        "resumes": signals.get("resumes", {}),
        "interviews": signals.get("interviews", {}),
        "profile": signals.get("profile", {}),
    }


def next_actions(signals: dict[str, dict]) -> list[str]:
    """Transparent, reorderable suggestions derived from the signals."""
    actions: list[str] = []
    profile = signals.get("profile", {})
    if profile.get("count", 0) < profile.get("of", 6):
        actions.append("Finish your profile for more points and insight.")
    if signals.get("skills", {}).get("count", 0) < 3:
        actions.append("Add a few more skills to strengthen your signal.")
    if signals.get("resumes", {}).get("count", 0) == 0:
        actions.append("Upload a resume so your application materials score.")
    if signals.get("interviews", {}).get("count", 0) < 3:
        actions.append("Complete an interview practice session.")
    if not actions:
        actions.append("Your twin is healthy. Keep practicing and reviewing weekly.")
    return actions[:5]


def build_snapshot(user: User) -> dict:
    """Full explainable snapshot of the user's readiness."""
    signals = compute_signals(user)
    score = readiness_score(signals)
    return {
        "score": score,
        "signals": signals,
        "total_earned": round(sum(float(s.get("earned", 0.0)) for s in signals.values()), 1),
        "total_max": sum(_WEIGHTS.values()),
        "skill_breakdown": skill_breakdown(signals),
        "next_actions": next_actions(signals),
        "generated_at": _now_iso(),
    }


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
