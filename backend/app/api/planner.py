"""Adaptive Growth Planner API — persistent weekly planning.

Endpoints:
  GET    /planner/settings   → the user's settings (auto-created)
  PUT    /planner/settings   → update capacity/goal/study days
  GET    /planner/tasks      → list tasks (optionally ?status=)
  POST   /planner/tasks      → create a task (auto-prioritised)
  PATCH  /planner/tasks/{id} → update / mark complete / skip
  DELETE /planner/tasks/{id} → remove a task
  POST   /planner/schedule   → auto-schedule unscheduled tasks onto study days
  POST   /planner/reschedule → move overdue tasks forward (report returned)
  GET    /planner/review     → weekly review + honest suggestions
"""
import json
from datetime import date

from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, DbSession
from app.models.growth import PlannerSetting, PlannerTask, TASK_CATEGORIES, TASK_STATUSES
from app.schemas.schemas import (
    PlannerSettingsOut,
    PlannerSettingsUpdate,
    PlannerTaskCreate,
    PlannerTaskOut,
    PlannerTaskUpdate,
    PlannerWeekReview,
)
from app.services import planner as planner_service

router = APIRouter(prefix="/planner", tags=["growth-planner"])


def _get_settings(user: CurrentUser, db: DbSession) -> PlannerSetting:
    s = db.query(PlannerSetting).filter(PlannerSetting.user_id == user.id).first()
    if s is None:
        s = PlannerSetting(user_id=user.id, study_days="[]")
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _get_task(task_id: int, user: CurrentUser, db: DbSession) -> PlannerTask:
    task = db.query(PlannerTask).filter(
        PlannerTask.id == task_id, PlannerTask.user_id == user.id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/settings", response_model=PlannerSettingsOut)
def get_settings(user: CurrentUser, db: DbSession):
    return _get_settings(user, db)


@router.put("/settings", response_model=PlannerSettingsOut)
def update_settings(payload: PlannerSettingsUpdate, user: CurrentUser, db: DbSession):
    s = _get_settings(user, db)
    data = payload.model_dump(exclude_unset=True)
    if "target_role" in data and data["target_role"] is not None:
        s.target_role = data["target_role"].strip()[:150] or None
    if "goal_deadline" in data:
        s.goal_deadline = data["goal_deadline"]
    if "hours_per_week" in data and data["hours_per_week"] is not None:
        s.hours_per_week = float(data["hours_per_week"])
    if "study_days" in data and data["study_days"] is not None:
        # Validate weekdays are 0..6 and dedupe/sort.
        days = sorted({int(d) for d in data["study_days"] if 0 <= int(d) <= 6})
        s.study_days = json.dumps(days)
    db.commit()
    db.refresh(s)
    return s


def _task_out(task: PlannerTask) -> PlannerTaskOut:
    return PlannerTaskOut.model_validate(task)


@router.get("/tasks", response_model=list[PlannerTaskOut])
def list_tasks(user: CurrentUser, db: DbSession, status: str | None = None):
    q = db.query(PlannerTask).filter(PlannerTask.user_id == user.id)
    if status:
        q = q.filter(PlannerTask.status == status)
    tasks = q.order_by(PlannerTask.target_date.asc().nullslast(),
                       PlannerTask.priority.asc()).all()
    return tasks


@router.post("/tasks", response_model=PlannerTaskOut, status_code=201)
def create_task(payload: PlannerTaskCreate, user: CurrentUser, db: DbSession):
    if payload.category not in TASK_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"category must be one of {list(TASK_CATEGORIES)}")
    minutes = payload.estimated_minutes or planner_service.default_minutes(payload.category)
    task = PlannerTask(
        user_id=user.id,
        title=payload.title.strip(),
        category=payload.category,
        target_date=payload.target_date,
        estimated_minutes=int(minutes),
        is_milestone=bool(payload.is_milestone),
        skill_tag=payload.skill_tag,
        notes=payload.notes,
        status="todo",
    )
    task.priority = planner_service.priority_for(task)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=PlannerTaskOut)
def update_task(task_id: int, payload: PlannerTaskUpdate,
                user: CurrentUser, db: DbSession):
    task = _get_task(task_id, user, db)
    data = payload.model_dump(exclude_unset=True)

    if "title" in data and data["title"] is not None:
        task.title = data["title"].strip()
    if "category" in data and data["category"] is not None:
        if data["category"] not in TASK_CATEGORIES:
            raise HTTPException(
                status_code=400,
                detail=f"category must be one of {list(TASK_CATEGORIES)}")
        task.category = data["category"]
    if "target_date" in data:
        task.target_date = data["target_date"]
    if "estimated_minutes" in data and data["estimated_minutes"] is not None:
        task.estimated_minutes = int(data["estimated_minutes"])
    if "skill_tag" in data:
        task.skill_tag = data["skill_tag"]
    if "notes" in data:
        task.notes = data["notes"]
    if "is_milestone" in data and data["is_milestone"] is not None:
        task.is_milestone = bool(data["is_milestone"])
    if "status" in data and data["status"] is not None:
        if data["status"] not in TASK_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"status must be one of {list(TASK_STATUSES)}")
        task.status = data["status"]
        if data["status"] == "completed":
            from datetime import datetime, timezone
            task.completed_at = datetime.now(timezone.utc)
        else:
            task.completed_at = None

    task.priority = planner_service.priority_for(task)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, user: CurrentUser, db: DbSession):
    task = _get_task(task_id, user, db)
    db.delete(task)
    db.commit()
    return {"deleted": True}


@router.post("/schedule", response_model=list[PlannerTaskOut])
def schedule(user: CurrentUser, db: DbSession):
    settings = _get_settings(user, db)
    tasks = db.query(PlannerTask).filter(PlannerTask.user_id == user.id).all()
    planner_service.schedule_unscheduled(tasks, settings)
    db.commit()
    for t in tasks:
        db.refresh(t)
    return sorted(tasks, key=lambda t: (t.target_date or date.max, t.priority))


@router.post("/reschedule")
def reschedule_overdue(user: CurrentUser, db: DbSession):
    settings = _get_settings(user, db)
    tasks = db.query(PlannerTask).filter(PlannerTask.user_id == user.id).all()
    report = planner_service.reschedule(tasks, settings)
    db.commit()
    return report


@router.get("/review", response_model=PlannerWeekReview)
def review(user: CurrentUser, db: DbSession):
    tasks = db.query(PlannerTask).filter(PlannerTask.user_id == user.id).all()
    return planner_service.weekly_review(tasks)
