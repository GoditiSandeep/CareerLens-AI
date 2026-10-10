"""Idempotent database seeder.

Creates reference data (skills, careers, jobs, aptitude, coding) and the
local demo account: demo@careerlens.ai / Demo@12345.
Safe to run multiple times — every section checks before inserting.
"""
import json

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.career import CareerPath, Skill
from app.models.content import AptitudeQuestion, CodingQuestion
from app.models.job import Job
from app.models.user import StudentProfile, User

DEMO_EMAIL = "demo@careerlens.ai"
DEMO_PASSWORD = "Demo@12345"


def seed_all(db: Session) -> dict[str, int | str]:
    from app.seed.aptitude_data import APTITUDE_QUESTIONS
    from app.seed.career_paths import CAREER_PATHS
    from app.seed.coding_data import CODING_QUESTIONS
    from app.seed.jobs_data import JOBS
    from app.seed.skills_data import SKILLS

    counts: dict[str, int | str] = {}

    if db.query(Skill).count() == 0:
        for s in SKILLS:
            db.add(Skill(name=s["name"], category=s.get("category", "technical"),
                         level=int(s.get("level", 50))))
        db.commit()
    counts["skills"] = db.query(Skill).count()

    if db.query(CareerPath).count() == 0:
        for c in CAREER_PATHS:
            req = c.get("required_skills", [])
            req_map = {name: 80 for name in req} if isinstance(req, list) else req
            db.add(CareerPath(
                name=c["name"], category=c.get("category", "Technology"),
                description=c.get("description", ""),
                required_skills=json.dumps(req_map),
                responsibilities=json.dumps(c.get("responsibilities", [])),
                roadmap=json.dumps(c.get("roadmap", [])),
                projects=json.dumps(c.get("projects", [])),
                interview_topics=json.dumps(c.get("interview_topics", [])),
                certifications=json.dumps(c.get("certifications", [])),
                salary_range=c.get("salary_range", ""),
                demand_level=c.get("demand_level", "High"),
            ))
        db.commit()
    counts["career_paths"] = db.query(CareerPath).count()

    if db.query(Job).count() == 0:
        for j in JOBS:
            db.add(Job(
                title=j["title"], company=j["company"],
                location=j.get("location", "Remote"),
                work_mode=j.get("work_mode", "remote"),
                salary=j.get("salary", ""), job_type=j.get("job_type", "job"),
                skills=json.dumps(j.get("skills", [])),
                experience_label=j.get("experience_label", "Fresher"),
                description=j.get("description", ""),
                industry=j.get("industry", "Technology"),
                is_sample=True,  # labelled as demo data in the UI
            ))
        db.commit()
    counts["jobs"] = db.query(Job).count()

    if db.query(AptitudeQuestion).count() == 0:
        for q in APTITUDE_QUESTIONS:
            db.add(AptitudeQuestion(
                category=q["category"], difficulty=q.get("difficulty", "easy"),
                topic=q.get("topic", ""), question=q["question"],
                options=json.dumps(q["options"]), correct_index=int(q["correct_index"]),
                explanation=q.get("explanation", ""),
            ))
        db.commit()
    counts["aptitude"] = db.query(AptitudeQuestion).count()

    if db.query(CodingQuestion).count() == 0:
        for q in CODING_QUESTIONS:
            db.add(CodingQuestion(
                category=q["category"], difficulty=q.get("difficulty", "easy"),
                title=q["title"], statement=q["statement"],
                examples=json.dumps([q.get("examples", "")]),
                constraints=q.get("constraints", ""),
                starter_code=q.get("starter_code", ""),
                test_cases=json.dumps(q.get("test_cases", [])),
                explanation=q.get("explanation", ""),
            ))
        db.commit()
    counts["coding"] = db.query(CodingQuestion).count()

    demo = db.query(User).filter(User.email == DEMO_EMAIL).first()
    if demo is None:
        demo = User(full_name="Demo Student", email=DEMO_EMAIL,
                    hashed_password=hash_password(DEMO_PASSWORD), is_demo=True)
        db.add(demo)
        db.commit()
        db.refresh(demo)
        db.add(StudentProfile(
            user_id=demo.id, college="Demo University", degree="B.Tech",
            branch="Computer Science", graduation_year=2027, current_year=3,
            desired_roles=json.dumps(["Software Developer", "Data Analyst"]),
            career_goals="Become a job-ready software developer.",
        ))
        db.commit()
    counts["demo"] = DEMO_EMAIL
    return counts
