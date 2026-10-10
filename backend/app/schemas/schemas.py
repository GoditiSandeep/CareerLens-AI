"""Pydantic schemas — auth, profile, skills, resumes, careers, roadmap."""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = Field(default=None, ge=2000, le=2100)
    current_year: Optional[int] = Field(default=None, ge=1, le=6)
    career_interests: Optional[list[str]] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: int
    full_name: str
    email: str
    is_demo: bool
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Profile / Onboarding ----------
class ProfileUpdate(BaseModel):
    about: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    current_year: Optional[int] = None
    cgpa: Optional[float] = None
    semester: Optional[int] = None
    subjects: Optional[list[str]] = None
    desired_roles: Optional[list[str]] = None
    industries: Optional[list[str]] = None
    preferred_locations: Optional[list[str]] = None
    work_preference: Optional[str] = None  # remote/hybrid/onsite
    salary_expectation: Optional[str] = None
    target_companies: Optional[list[str]] = None
    strengths: Optional[list[str]] = None
    interests: Optional[list[str]] = None
    career_goals: Optional[str] = None
    onboarding_completed: Optional[bool] = None


class OnboardingSkills(BaseModel):
    skills: list[dict[str, object]] = Field(default_factory=list)


class OnboardingComplete(BaseModel):
    skills: list[dict[str, object]] = Field(default_factory=list)
    desired_roles: Optional[list[str]] = None
    industries: Optional[list[str]] = None
    preferred_locations: Optional[list[str]] = None
    work_preference: Optional[str] = None
    salary_expectation: Optional[str] = None
    target_companies: Optional[list[str]] = None


class StudentProfileOut(ORMModel):
    id: int
    user_id: int
    location: Optional[str] = None
    phone: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    graduation_year: Optional[int] = None
    current_year: Optional[int] = None
    cgpa: Optional[float] = None
    semester: Optional[int] = None
    subjects: Optional[str] = None
    desired_roles: Optional[str] = None
    industries: Optional[str] = None
    preferred_locations: Optional[str] = None
    work_preference: Optional[str] = None
    salary_expectation: Optional[str] = None
    target_companies: Optional[str] = None
    strengths: Optional[str] = None
    interests: Optional[str] = None
    career_goals: Optional[str] = None
    about: Optional[str] = None
    onboarding_completed: bool = False
    onboarding_step: int = 0


# ---------- Skills ----------
class SkillCreate(BaseModel):
    name: str
    category: str = "technical"
    level: float = Field(default=30, ge=0, le=100)
    target_level: float = Field(default=70, ge=0, le=100)


class SkillUpdate(BaseModel):
    level: Optional[float] = Field(default=None, ge=0, le=100)
    target_level: Optional[float] = Field(default=None, ge=0, le=100)


class SkillOut(ORMModel):
    id: int
    name: str
    category: str
    level: float
    target_level: float = 80.0


# ---------- Resumes ----------
class CategoryBreakdown(BaseModel):
    keywords: float = 0
    skills: float = 0
    experience: float = 0
    projects: float = 0
    education: float = 0
    formatting: float = 0
    alignment: float = 0


class ResumeOut(ORMModel):
    id: int
    original_filename: str
    content_type: str
    size_bytes: int
    is_primary: bool
    uploaded_at: datetime


class ResumeAnalysisOut(ORMModel):
    id: int
    resume_id: int
    ats_score: float
    match_score: float = 0.0
    categories: CategoryBreakdown | dict = Field(default_factory=dict)
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    missing_sections: list[str] = Field(default_factory=list)
    keywords_found: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    created_at: datetime


# ---------- Careers ----------
class CareerOut(ORMModel):
    id: int
    name: str
    category: str
    description: str
    required_skills: dict[str, float] | list[str] | str = Field(default="[]")
    responsibilities: list[str] | str = Field(default="[]")
    roadmap: list[dict] | str = Field(default="[]")
    projects: list[str] | str = Field(default="[]")
    interview_topics: list[str] | str = Field(default="[]")
    certifications: list[str] | str = Field(default="[]")
    salary_range: str
    demand_level: str
    growth_potential: str = "High"
    suitability: float = 0.0


# ---------- Roadmap ----------
class RoadmapItemUpdate(BaseModel):
    status: Optional[str] = None
    deadline: Optional[date] = None
    notes: Optional[str] = None


class RoadmapItemOut(ORMModel):
    id: int
    roadmap_id: int
    month: int
    title: str
    description: str
    category: str
    status: str
    deadline: Optional[date] = None
    resources: str
    notes: Optional[str] = None
class RoadmapOut(ORMModel):
    id: int
    career_path_name: str
    title: str
    total_months: int
    progress: float
    generated_at: datetime
    items: list[RoadmapItemOut] = Field(default_factory=list)


# ---------- Jobs & Applications ----------
class JobOut(ORMModel):
    id: int
    title: str
    company: str
    location: str
    work_mode: str
    salary: str
    job_type: str
    skills: list[str] | str = Field(default="[]")
    experience_label: str
    description: str
    industry: str
    posted_on: Optional[datetime] = None
    is_active: bool = True
    match_score: float = 0.0
    saved: bool = False
    is_active: bool


class JobMatchOut(BaseModel):
    job_id: int
    title: str
    company: str
    match_score: float
    matching_skills: list[str]
    missing_skills: list[str]


class ApplicationCreate(BaseModel):
    job_id: Optional[int] = None  # optional: manual/off-platform applications
    company: str = Field(min_length=1, max_length=160)
    role: str = Field(min_length=1, max_length=160)
    job_url: Optional[str] = None
    status: str = "wishlist"
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    deadline: Optional[datetime] = None


class ApplicationOut(ORMModel):
    id: int
    job_id: Optional[int] = None
    company: str
    role: str
    status: str
    applied_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------- Interviews ----------
class InterviewStart(BaseModel):
    role: str
    difficulty: str = "medium"
    interview_type: str = "practice"  # practice/mock


class InterviewAnswer(BaseModel):
    answer: str


class InterviewQuestionIn(BaseModel):
    id: int
    order_index: int
    category: str
    question: str
    question_type: str
    options: Optional[str] = None


class InterviewSessionOut(ORMModel):
    id: int
    role: str
    difficulty: str
    status: str
    current_index: int = 0
    interview_type: str = "practice"
    started_at: datetime
    completed_at: Optional[datetime] = None
    report: Optional[str] = None


# ---------- Aptitude ----------
class AptitudeQuestionOut(ORMModel):
    id: int
    category: str
    difficulty: str
    topic: str
    question: str
    options: str


class AptitudeSubmit(BaseModel):
    question_id: int
    selected_index: int
    category: Optional[str] = None


class AptitudeResultOut(BaseModel):
    correct: bool
    correct_index: int
    explanation: Optional[str] = None
    score: int = 0
    total: int = 0


# ---------- Coding ----------
class CodingQuestionOut(ORMModel):
    id: int
    category: str
    difficulty: str
    title: str
    statement: str
    examples: str
    constraints: Optional[str] = None
    starter_code: Optional[str] = None


class CodingSubmit(BaseModel):
    code: str
    language: str = "python"


class CodingResult(BaseModel):
    passed: int
    total: int
    status: str
    results: list[dict] = Field(default_factory=list)


# ---------- Applications / Achievements / Projects / Chat ----------


class ApplicationOut(ORMModel):
    id: int
    job_id: Optional[int] = None
    company: str
    role: str
    status: str
    applied_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    job_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AchievementOut(ORMModel):
    id: int
    title: str
    achievement_type: str = "award"
    organization: Optional[str] = None
    date: Optional[datetime] = None
    description: Optional[str] = None
    url: Optional[str] = None


class AchievementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    achievement_type: str = "award"
    organization: Optional[str] = None
    date: Optional[datetime] = None
    description: Optional[str] = None
    url: Optional[str] = None


class CertificationOut(ORMModel):
    id: int
    name: str
    issuer: Optional[str] = None
    issue_date: Optional[datetime] = None
    credential_url: Optional[str] = None
    skills: list[str] = Field(default_factory=list)


class CertificationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    issuer: Optional[str] = None
    issue_date: Optional[datetime] = None
    credential_url: Optional[str] = None
    skills: list[str] = Field(default_factory=list)


class UserProjectOut(ORMModel):
    id: int
    title: str
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    category: str = "web"
    difficulty: str = "Beginner"
    github_url: Optional[str] = None
    status: str = "planned"
    created_at: datetime


class UserProjectCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    category: str = "web"
    difficulty: str = "Beginner"
    github_url: Optional[str] = None
    status: str = "planned"


class ChatHistoryOut(ORMModel):
    id: int
    role: str
    content: str
    created_at: datetime


# ---------- Chat ----------
class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


# ---------- Dashboard ----------
class DashboardResponse(BaseModel):
    career_readiness: float
    ats_score: float
    skill_score: float
    interview_readiness: float
    interview_score: float
    project_strength: float
    profile_completeness: float
    learning_progress: float
    total_applications: int
    saved_jobs: int
    recommended_roles: list[str]
    next_actions: list[str]
    breakdown: dict


# ---------- Skill gaps ----------
class SkillGapItem(BaseModel):
    name: str
    current: float
    required: float
    gap: float


class SkillGapOut(BaseModel):
    target: str
    gaps: list[SkillGapItem]
    recommendations: list[str]
    order_index: int = 0


class RoadmapItemOut(ORMModel):
    id: int
    month: int
    title: str
    description: str = ""
    category: str = "learning"
    status: str = "pending"
    deadline: Optional[date] = None
    resources: str = "[]"
    notes: Optional[str] = None
    order_index: int = 0


class RoadmapItemUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    deadline: Optional[date] = None


class ProjectOut(BaseModel):
    title: str
    difficulty: str = "Beginner"
    category: str = "web"
    technologies: list[str] = Field(default_factory=list)
    problem_statement: str = ""
    features: list[str] = Field(default_factory=list)
    learning_outcomes: list[str] = Field(default_factory=list)
    estimated_duration: str = "2-3 weeks"
    resume_value: str = "Medium"
    github_checklist: list[str] = Field(default_factory=list)


class RoadmapOut(ORMModel):
    id: int
    career_path_name: str
    title: str
    total_months: int
    progress: float
    generated_at: datetime
    items: list[RoadmapItemOut] = Field(default_factory=list)


# ---------- Compatibility aliases (routers reference these names) ----------

CareerRecommendationOut = CareerOut


class RoadmapGenerateRequest(BaseModel):
    target_role: str = Field(min_length=2, max_length=150)
    months: int = Field(default=6, ge=1, le=12)


class JobMatchRequest(BaseModel):
    job_description: str = Field(min_length=20)
    job_id: Optional[int] = None


class JobMatchResponse(BaseModel):
    match_score: float = 0
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    recommended_keywords: list[str] = Field(default_factory=list)
    experience_match: float = 0
    education_match: float = 0
    role_suitability: str = ""
    recommendation: str = ""
    why_match: list[str] = Field(default_factory=list)
    why_not_match: list[str] = Field(default_factory=list)
    what_to_improve: list[str] = Field(default_factory=list)