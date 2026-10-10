"""Job browsing, match scores, save/apply."""
import json

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, DbSession
from app.models.job import Application, Job, SavedJob
from app.schemas.schemas import ApplicationCreate, JobOut
from app.services.scoring import job_match_score

router = APIRouter(tags=["jobs"])

STATUSES = ("wishlist", "applied", "assessment", "interview", "offer", "rejected")


def _job_out(job: Job, match: float = 0.0, saved: bool = False) -> dict:
    return {
        "id": job.id, "title": job.title, "company": job.company,
        "location": job.location, "work_mode": job.work_mode,
        "salary": job.salary, "job_type": job.job_type,
        "skills": json.loads(job.skills or "[]"),
        "experience_label": job.experience_label,
        "description": job.description, "industry": job.industry,
        "posted_on": job.posted_on, "match_score": match, "saved": saved,
    }


@router.get("/jobs", response_model=list[JobOut])
def list_jobs(user: CurrentUser, db: DbSession, q: str = "", work_mode: str = "",
              job_type: str = ""):
    mine = {s.name for s in user.skills}
    saved_ids = {s.job_id for s in db.query(SavedJob).filter(
        SavedJob.user_id == user.id).all()}
    query = db.query(Job)
    if q:
        like = f"%{q}%"
        query = query.filter((Job.title.like(like)) | (Job.company.like(like)))
    if work_mode:
        query = query.filter(Job.work_mode == work_mode)
    if job_type:
        query = query.filter(Job.job_type == job_type)
    out = []
    for job in query.order_by(Job.id).all():
        try:
            skills = json.loads(job.skills or "[]")
        except (ValueError, TypeError):
            skills = []
        out.append(_job_out(job, job_match_score(mine, skills), job.id in saved_ids))
    out.sort(key=lambda j: j["match_score"], reverse=True)
    return out


@router.post("/jobs/{job_id}/save")
def save_job(job_id: int, user: CurrentUser, db: DbSession):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    existing = db.query(SavedJob).filter(
        SavedJob.user_id == user.id, SavedJob.job_id == job_id).first()
    if existing:
        return {"saved": job_id, "duplicate": True}
    db.add(SavedJob(user_id=user.id, job_id=job_id))
    db.commit()
    return {"saved": job_id}


@router.delete("/jobs/{job_id}/save")
def unsave_job(job_id: int, user: CurrentUser, db: DbSession):
    db.query(SavedJob).filter(
        SavedJob.user_id == user.id, SavedJob.job_id == job_id).delete()
    db.commit()
    return {"unsaved": job_id}


@router.post("/jobs/{job_id}/apply")
def apply_to_job(job_id: int, user: CurrentUser, db: DbSession):
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    existing = db.query(Application).filter(
        Application.user_id == user.id, Application.job_id == job_id).first()
    if existing:
        existing.status = "applied"
        db.commit()
        return {"application_id": existing.id, "status": "applied"}
    app = Application(user_id=user.id, job_id=job_id, company=job.company,
                      role=job.title, status="applied")
    db.add(app)
    db.commit()
    db.refresh(app)
    return {"application_id": app.id, "status": "applied"}


@router.get("/applications", response_model=list[dict])
def list_applications(user: CurrentUser, db: DbSession):
    apps = db.query(Application).filter(
        Application.user_id == user.id).order_by(Application.updated_at.desc()).all()
    return [{"id": a.id, "job_id": a.job_id, "company": a.company, "role": a.role,
             "status": a.status, "applied_date": a.applied_date, "deadline": a.deadline,
             "job_url": a.job_url, "notes": a.notes, "created_at": a.created_at,
             "updated_at": a.updated_at} for a in apps]


@router.post("/applications", status_code=201)
def create_application(payload: ApplicationCreate, user: CurrentUser, db: DbSession):
    status = payload.status or "wishlist"
    if status not in STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use one of {STATUSES}")
    app = Application(user_id=user.id, job_id=payload.job_id, company=payload.company,
                      role=payload.role, status=status, job_url=payload.job_url,
                      notes=payload.notes)
    db.add(app)
    db.commit()
    db.refresh(app)
    return {"application_id": app.id, "status": app.status}


@router.put("/applications/{app_id}")
def update_application(app_id: int, payload: dict, user: CurrentUser, db: DbSession):
    app = db.query(Application).filter(
        Application.id == app_id, Application.user_id == user.id).first()
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    if payload.get("status"):
        if payload["status"] not in STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        app.status = payload["status"]
    for field in ("notes", "job_url", "deadline", "company", "role"):
        if field in payload and payload[field] is not None:
            setattr(app, field, payload[field])
    db.commit()
    return {"application_id": app.id, "status": app.status}
