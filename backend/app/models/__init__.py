"""Model registry. Importing this package registers every model on Base."""

from app.models.user import User, StudentProfile
from app.models.career import (
    Skill,
    StudentSkill,
    CareerPath,
    Roadmap,
    RoadmapItem,
)
from app.models.resume import Resume, ResumeAnalysis
from app.models.job import Job, SavedJob, Application
from app.models.content import (
    Achievement,
    Certification,
    UserProject,
    ChatMessage,
    InterviewSession,
    InterviewQuestion,
    AptitudeQuestion,
    AptitudeAttempt,
    CodingQuestion,
    CodingAttempt,
)

__all__ = [
    "User",
    "StudentProfile",
    "Skill",
    "StudentSkill",
    "CareerPath",
    "Roadmap",
    "RoadmapItem",
    "Resume",
    "ResumeAnalysis",
    "Job",
    "SavedJob",
    "Application",
    "Achievement",
    "Certification",
    "UserProject",
    "ChatMessage",
    "InterviewSession",
    "InterviewQuestion",
    "AptitudeQuestion",
    "AptitudeAttempt",
    "CodingQuestion",
    "CodingAttempt",
]
