"""Career-readiness aggregator — weighted 0-100 score with explanation."""
from sqlalchemy.orm import Session

from app.models.user import User


def readiness_for_user(db: Session, user: User) -> dict:
    from app.models.job import Application, SavedJob
    from app.models.resume import ResumeAnalysis

    profile = user.profile
    skills = list(user.skills or [])
    resumes = list(user.resumes or [])
    roadmaps = list(user.roadmaps or [])
    interviews = list(user.interviews or [])

    analyses = (
        db.query(ResumeAnalysis).filter(ResumeAnalysis.user_id == user.id)
        .order_by(ResumeAnalysis.created_at.desc()).all()
    )
    ats = float(analyses[0].ats_score) if analyses else 0.0

    skill_score = round(sum(s.level for s in skills) / len(skills), 1) if skills else 20.0
    project_strength = min(95.0, 20 + len(user.projects) * 15) if hasattr(user, "projects") else 20.0

    profile_fields = [
        profile and profile.college, profile and profile.degree, profile and profile.branch,
        profile and profile.location, profile and profile.career_goals,
        profile and profile.desired_roles, bool(skills), bool(resumes),
    ]
    completeness = round(sum(1 for f in profile_fields if f) / len(profile_fields) * 100, 1)

    learning = 0.0
    if roadmaps:
        learning = round(sum(r.progress for r in roadmaps) / len(roadmaps), 1)

    interview = 60.0 if interviews else 30.0
    cert_boost = min(15.0, len(user.certifications) * 5 + len(user.achievements) * 3)

    apps = db.query(Application).filter(Application.user_id == user.id).count()
    saved = db.query(SavedJob).filter(SavedJob.user_id == user.id).count()
    app_score = min(80.0, apps * 10)

    overall = round(
        0.22 * ats + 0.20 * skill_score + 0.15 * project_strength
        + 0.12 * completeness + 0.10 * learning + 0.10 * interview
        + 0.06 * app_score + 0.05 * min(100.0, 50 + cert_boost), 1,
    )
    roles = []
    if profile and profile.desired_roles:
        import json

        try:
            roles = json.loads(profile.desired_roles)[:5]
        except (ValueError, TypeError):
            roles = []

    actions = []
    if not resumes:
        actions.append("Upload your resume to get an ATS score")
    if len(user.projects) < 2:
        actions.append(f"Add {2 - len(user.projects)} more project(s) to strengthen your profile")
    if skill_score < 70:
        actions.append("Close your top skill gap — practice 30 min daily")
    if not interviews:
        actions.append("Take your first mock interview")
    if apps < 3 and roles:
        actions.append(f"Apply to 3 {roles[0]} openings from Jobs")
    if learning < 50 and roadmaps:
        actions.append("Complete your next roadmap milestone")
    if not actions:
        actions.append("Keep your streak — review this week's goals")

    return {
        "career_readiness": overall,
        "ats_score": ats,
        "skill_score": skill_score,
        "interview_readiness": interview,
        "interview_score": interview,
        "project_strength": project_strength,
        "profile_completeness": completeness,
        "learning_progress": learning,
        "total_applications": apps,
        "saved_jobs": saved,
        "recommended_roles": roles,
        "next_actions": actions[:5],
        "breakdown": {
            "resume_weight": 0.22, "skills_weight": 0.20, "projects_weight": 0.15,
            "profile_weight": 0.12, "learning_weight": 0.10, "interview_weight": 0.10,
            "applications_weight": 0.06, "certifications_weight": 0.05,
        },
    }
