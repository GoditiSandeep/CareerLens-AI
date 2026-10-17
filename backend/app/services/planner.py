"""Adaptive Growth Planner — transparent scheduling and effort.

Design notes (shown to users, not hidden):
  * Task priority is derived from category weight + how close the task's target
    date is. Milestones always rank first.
  * Effort (estimated_minutes) is stored per task and defaults by category; the
    weekly capacity is the user's declared hours_per_week split across their
    chosen study days.
  * Scheduling places unscheduled tasks onto the nearest upcoming study day with
    remaining capacity, newest-deadline first — never overbook a day.
  * Rescheduling moves overdue/undone tasks forward to the next study day and
    reports exactly what changed so nothing is silently lost.
"""
from __future__ import annotations

from datetime import date, timedelta

from app.models.growth import PlannerSetting, PlannerTask, TASK_CATEGORIES

# Category weight (lower = more important) and a sensible default effort.
CATEGORY_WEIGHT = {
    "interview": 1,     # time-sensitive, high leverage
    "application": 1,
    "project": 2,
    "learning": 3,
    "revision": 4,
}
DEFAULT_MINUTES = {
    "learning": 60,
    "revision": 30,
    "project": 90,
    "application": 45,
    "interview": 60,
}


def default_minutes(category: str) -> int:
    return DEFAULT_MINUTES.get(category, 60)


def priority_for(task: PlannerTask, today: date | None = None) -> int:
    """1=high, 2=medium, 3=low. Milestones first, then urgency, then category."""
    today = today or date.today()
    if task.is_milestone:
        return 1
    weight = CATEGORY_WEIGHT.get(task.category, 3)
    # Urgency bonus when the deadline is near.
    if task.target_date is not None:
        days = (task.target_date - today).days
        if days < 0:
            weight -= 1  # overdue → more urgent
        elif days <= 3:
            weight -= 0
        else:
            weight += 1
    if weight <= 1:
        return 1
    if weight == 2:
        return 2
    return 3


def parse_study_days(setting: PlannerSetting) -> set[int]:
    import json

    if not setting or not setting.study_days:
        # Default: Mon-Fri.
        return {0, 1, 2, 3, 4}
    try:
        parsed = json.loads(setting.study_days)
        days = {int(d) for d in parsed if 0 <= int(d) <= 6}
        return days or {0, 1, 2, 3, 4}
    except (ValueError, TypeError):
        return {0, 1, 2, 3, 4}


def daily_capacity_minutes(setting: PlannerSetting) -> int:
    """Total weekly minutes divided across the chosen study days."""
    if not setting:
        return 120
    days = len(parse_study_days(setting))
    weekly = float(setting.hours_per_week or 8) * 60
    return max(30, int(weekly / max(1, days)))


def schedule_unscheduled(tasks: list[PlannerTask], setting: PlannerSetting,
                         today: date | None = None) -> list[PlannerTask]:
    """Place unscheduled tasks onto upcoming study days without overbooking.

    Returns the list of tasks that were (re)assigned a date (mutated in place).
    """
    today = today or date.today()
    study_days = parse_study_days(setting)
    cap = daily_capacity_minutes(setting)

    # Load already-booked minutes per study day.
    booked: dict[date, int] = {}
    for t in tasks:
        if t.target_date is not None and t.status != "completed":
            booked[t.target_date] = booked.get(t.target_date, 0) + int(t.estimated_minutes)

    # Order by priority then earliest deadline, so important work lands first.
    unscheduled = [t for t in tasks if t.target_date is None and t.status != "completed"]
    unscheduled.sort(key=lambda t: (
        priority_for(t, today),
        t.target_date or date.max,
    ))

    changed: list[PlannerTask] = []
    for t in unscheduled:
        day = next_study_day(today, study_days)
        placed = None
        for _ in range(28):  # look up to 4 weeks ahead
            if day.weekday() in study_days and booked.get(day, 0) + t.estimated_minutes <= cap:
                placed = day
                break
            day += timedelta(days=1)
        if placed is None:
            placed = next_study_day(today, study_days)  # best effort
        t.target_date = placed
        booked[placed] = booked.get(placed, 0) + int(t.estimated_minutes)
        t.priority = priority_for(t, today)
        changed.append(t)
    return changed


def reschedule(tasks: list[PlannerTask], setting: PlannerSetting,
               today: date | None = None) -> dict:
    """Move overdue/unfinished tasks to the next study day.

    Only affects tasks whose target_date is in the past and not completed.
    Returns a report of what moved for a transparent weekly review.
    """
    today = today or date.today()
    study_days = parse_study_days(setting)
    cap = daily_capacity_minutes(setting)
    moved = []
    for t in tasks:
        if t.status == "completed":
            continue
        if t.target_date is not None and t.target_date < today:
            new_day = next_study_day(today, study_days)
            old = t.target_date
            t.target_date = new_day
            t.priority = priority_for(t, today)
            moved.append({"id": t.id, "title": t.title,
                          "from": old.isoformat(), "to": new_day.isoformat()})
    return {"moved": moved, "count": len(moved)}


def week_bounds(today: date | None = None) -> tuple[date, date]:
    """Monday..Sunday of the current week."""
    today = today or date.today()
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)


def weekly_review(tasks: list[PlannerTask], today: date | None = None) -> dict:
    """Completed vs skipped vs pending this week + honest suggestions."""
    today = today or date.today()
    start, end = week_bounds(today)
    in_week = [t for t in tasks
               if t.target_date and start <= t.target_date <= end]
    completed = [t for t in in_week if t.status == "completed"]
    skipped = [t for t in in_week if t.status == "skipped"]
    pending = [t for t in in_week if t.status in ("todo", "in_progress")]

    minutes_completed = sum(int(t.estimated_minutes) for t in completed)
    minutes_planned = sum(int(t.estimated_minutes) for t in in_week)

    suggestions: list[str] = []
    if skipped:
        suggestions.append(
            f"You skipped {len(skipped)} task(s) — consider moving them, not deleting.")
    if pending and len(completed) >= len(pending):
        suggestions.append("Strong week — tackle the next milestone to keep momentum.")
    if not completed and in_week:
        suggestions.append("No tasks completed yet this week — try a smaller first step.")
    if minutes_planned and minutes_completed / max(1, minutes_planned) < 0.5:
        suggestions.append(
            "You planned more time than you used. Trim your weekly hours to stay realistic.")
    if not suggestions:
        suggestions.append("Steady progress — keep your current pace and review weekly.")

    return {
        "week_start": start,
        "completed": len(completed),
        "skipped": len(skipped),
        "pending": len(pending),
        "minutes_planned": minutes_planned,
        "minutes_completed": minutes_completed,
        "suggestions": suggestions,
    }


def next_study_day(from_date: date, study_days: set[int]) -> date:
    """The first date on/after from_date that is a chosen study day."""
    d = from_date
    for _ in range(7):
        if d.weekday() in study_days:
            return d
        d += timedelta(days=1)
    return from_date
