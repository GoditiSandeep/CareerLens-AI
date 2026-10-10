"""Resume analysis + JD matching endpoints (appended to resumes router)."""
import json
from datetime import datetime, timezone

from fastapi import HTTPException

from app.ai.service import get_ai_provider
from app.api.deps import CurrentUser, DbSession
from app.api.resumes import _analysis_out, router
from app.models.resume import Resume, ResumeAnalysis
from app.schemas.schemas import (
    JobMatchRequest,
    JobMatchResponse,
    ResumeAnalysisOut,
)
from app.services.scoring import ats_breakdown, job_match_score, keyword_hits


@router.post("/{resume_id}/analyze", response_model=ResumeAnalysisOut)
def analyze_resume(resume_id: int, user: CurrentUser, db: DbSession):
    resume = db.query(Resume).filter(
        Resume.id == resume_id, Resume.user_id == user.id).first()
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    base = ats_breakdown(resume.extracted_text or "")
    provider = get_ai_provider()
    ai_text = provider.complete(
        f"##resume_analysis##\nResume text:\n{(resume.extracted_text or '')[:4000]}",
        system="ats_score resume analyzer returning JSON advice",
    )
    strengths = [f"Keyword coverage: {', '.join(base['keyword_hits'][:5]) or 'add core skills'}"]
    improvements = [f"Missing sections: {', '.join(base['missing_sections']) or 'none'}"]
    if not base["contact"]["email"]:
        improvements.append("Add a professional email address at the top.")
    if not base["contact"]["link"]:
        improvements.append("Add LinkedIn/GitHub links.")
    recs = [
        "Add measurable impact to project bullets (e.g. '+40% faster').",
        "Mirror keywords from target job descriptions in Skills.",
        "Keep formatting parser-friendly: single column, standard headings.",
        ai_text[:500],
    ]
    existing = db.query(ResumeAnalysis).filter(
        ResumeAnalysis.resume_id == resume.id).first()
    if existing is None:
        existing = ResumeAnalysis(resume_id=resume.id, user_id=user.id)
        db.add(existing)
    existing.ats_score = base["ats_score"]
    existing.categories = json.dumps(base["categories"])
    existing.strengths = json.dumps(strengths)
    existing.improvements = json.dumps(improvements)
    existing.missing_sections = json.dumps(base["missing_sections"])
    existing.keywords = json.dumps(base["keyword_hits"])
    existing.recommendations = json.dumps(recs)
    existing.summary = ai_text[:1000]
    existing.created_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(existing)
    return _analysis_out(existing)


@router.post("/{resume_id}/job-match", response_model=JobMatchResponse)
def job_match(resume_id: int, payload: JobMatchRequest, user: CurrentUser, db: DbSession):
    resume = db.query(Resume).filter(
        Resume.id == resume_id, Resume.user_id == user.id).first()
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    resume_skills = set(keyword_hits(resume.extracted_text or ""))
    jd_skills = keyword_hits(payload.job_description or "") or \
        list({w.strip(".,") for w in payload.job_description.split() if len(w) > 3})[:20]
    score = job_match_score(resume_skills, jd_skills)
    matched = sorted(resume_skills & {s.lower() for s in jd_skills})
    missing = [s for s in jd_skills if s.lower() not in resume_skills][:15]
    provider = get_ai_provider()
    ai_text = provider.complete(
        f"##job_match##\nResume:\n{(resume.extracted_text or '')[:2500]}\n\n"
        f"JD:\n{payload.job_description[:2500]}",
        system="job_match analyzer",
    )
    return JobMatchResponse(
        match_score=score, matched_skills=matched, missing_skills=missing,
        recommended_keywords=missing[:10], experience_match=score,
        education_match=75.0,
        role_suitability="Strong fit" if score >= 70 else
        "Partial fit" if score >= 45 else "Stretch — upskill first",
        recommendation="Apply" if score >= 60 else "Improve first, then apply",
        why_match=[f"Matched: {', '.join(matched[:6]) or 'transferable fundamentals'}",
                   ai_text[:400]],
        why_not_match=[f"Missing/gap: {', '.join(missing[:6]) or 'minor keyword tuning'}"],
        what_to_improve=[f"Add to resume: {', '.join(missing[:5]) or 'role-specific metrics'}",
                         "Quantify 2-3 bullets with the JD's language."],
    )
