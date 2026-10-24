"""Resume upload, analysis, job matching, history."""
import json
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from sqlalchemy import desc

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.models.resume import Resume, ResumeAnalysis
from app.schemas.schemas import ResumeAnalysisOut, ResumeOut
from app.services.resume_parser import extract_resume_text

router = APIRouter(prefix="/resumes", tags=["resumes"])

# Strict whitelist for the stored filename: letters, digits, dot, dash, underscore.
_UNSAFE_NAME_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


def safe_upload_name(user_id: int, filename: str | None) -> str:
    """Build a storage name that can never escape the uploads directory.

    The client-supplied filename is reduced to its final path component, then
    every character outside the whitelist (including path separators and
    anything that could form ``..`` segments) is replaced. The result is always
    exactly ``user{id}_{uuid32}_{safe}`` — a single flat path component inside
    ``settings.upload_dir``. The raw filename is still stored separately in the
    database for display only; it is never used to build a path.
    """
    base = Path(filename or "").name          # drop any directory components
    base = _UNSAFE_NAME_CHARS.sub("_", base)  # whitelist remaining characters
    base = base.strip("._")[:60]              # no leading/trailing dots
    return f"user{user_id}_{uuid.uuid4().hex}_{base or 'resume'}"


def _analysis_out(a: ResumeAnalysis) -> ResumeAnalysisOut:
    return ResumeAnalysisOut(
        id=a.id, resume_id=a.resume_id, ats_score=a.ats_score,
        match_score=a.match_score,
        categories=json.loads(a.categories or "{}"),
        strengths=json.loads(a.strengths or "[]"),
        improvements=json.loads(a.improvements or "[]"),
        missing_sections=json.loads(a.missing_sections or "[]"),
        keywords_found=json.loads(a.keywords or "[]"),
        recommendations=json.loads(a.recommendations or "[]"),
        created_at=a.created_at,
    )


@router.post("/upload", response_model=ResumeOut, status_code=201)
async def upload_resume(file: UploadFile, user: CurrentUser, db: DbSession):
    # Display copy of the client filename, truncated to the column size (the
    # storage path below never uses it).
    raw_name = (file.filename or "resume")[:255]
    safe = safe_upload_name(user.id, file.filename)
    dest = settings.upload_dir / safe
    text, size, ctype = await extract_resume_text(file, dest)
    first = db.query(Resume).filter(Resume.user_id == user.id).count() == 0
    resume = Resume(user_id=user.id, file_path=str(dest),
                    original_filename=raw_name,
                    content_type=ctype, size_bytes=size,
                    extracted_text=text, is_primary=first)
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.get("", response_model=list[ResumeOut])
def list_resumes(user: CurrentUser, db: DbSession):
    return db.query(Resume).filter(Resume.user_id == user.id).order_by(
        desc(Resume.uploaded_at)).all()


@router.get("/{resume_id}", response_model=ResumeOut)
def get_resume(resume_id: int, user: CurrentUser, db: DbSession):
    resume = db.query(Resume).filter(
        Resume.id == resume_id, Resume.user_id == user.id).first()
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


@router.delete("/{resume_id}")
def delete_resume(resume_id: int, user: CurrentUser, db: DbSession):
    resume = db.query(Resume).filter(
        Resume.id == resume_id, Resume.user_id == user.id).first()
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    db.query(ResumeAnalysis).filter(ResumeAnalysis.resume_id == resume.id).delete()
    db.delete(resume)
    db.commit()
    return {"deleted": resume_id}


@router.get("/{resume_id}/analysis", response_model=ResumeAnalysisOut)
def get_analysis(resume_id: int, user: CurrentUser, db: DbSession):
    analysis = db.query(ResumeAnalysis).filter(
        ResumeAnalysis.resume_id == resume_id,
        ResumeAnalysis.user_id == user.id).first()
    if analysis is None:
        raise HTTPException(status_code=404, detail="No analysis yet — POST /analyze first")
    return _analysis_out(analysis)
