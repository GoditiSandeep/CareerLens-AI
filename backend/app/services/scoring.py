"""Deterministic ATS / skill-gap / career-match scoring helpers.

Used alongside the AI provider: heuristics give a stable baseline,
AI adds human-readable recommendations on top.
"""
import json
import re

KEYWORD_BANK = [
    "python", "javascript", "typescript", "java", "sql", "react", "node",
    "django", "flask", "fastapi", "aws", "docker", "kubernetes", "git",
    "linux", "machine learning", "deep learning", "pandas", "numpy",
    "tensorflow", "pytorch", "excel", "power bi", "tableau", "figma",
    "communication", "leadership", "agile", "rest", "api",
]

SECTIONS = ["summary", "skills", "education", "experience", "projects", "certifications"]


def keyword_hits(text: str) -> list[str]:
    lower = text.lower()
    return [k for k in KEYWORD_BANK if k in lower]


def section_coverage(text: str) -> dict[str, bool]:
    lower = text.lower()
    return {s: (s in lower) for s in SECTIONS}


def contact_present(text: str) -> dict[str, bool]:
    return {
        "email": bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text)),
        "phone": bool(re.search(r"\+?\d[\d\s\-]{7,}\d", text)),
        "link": ("linkedin" in text.lower() or "github" in text.lower()),
    }


def ats_breakdown(text: str) -> dict:
    """Return 0-100 category scores + overall ATS score."""
    words = text.split()
    hits = keyword_hits(text)
    coverage = section_coverage(text)
    contact = contact_present(text)

    keywords = min(95.0, 30 + len(set(hits)) * 6)
    skills = min(95.0, 35 + len(set(hits)) * 5)
    experience = 72.0 if ("experience" in text.lower() or "intern" in text.lower()) else 45.0
    projects = 78.0 if "project" in text.lower() else 40.0
    education = 80.0 if coverage.get("education") else 48.0
    formatting = 82.0 if (text.count("\n") > 8 and len(words) > 120) else 60.0
    alignment = min(90.0, 50 + len(set(hits)) * 2.5)

    overall = round(
        0.22 * keywords + 0.16 * skills + 0.14 * experience + 0.14 * projects
        + 0.12 * education + 0.12 * formatting + 0.10 * alignment, 1,
    )
    missing = [s for s, present in coverage.items() if not present]
    return {
        "ats_score": overall,
        "categories": {
            "keywords": round(keywords, 1),
            "skills": round(skills, 1),
            "experience": experience,
            "projects": projects,
            "education": education,
            "formatting": formatting,
            "alignment": round(alignment, 1),
        },
        "keyword_hits": sorted(set(hits)),
        "missing_sections": missing,
        "contact": contact,
        "word_count": len(words),
    }


def skill_gaps(student_skills: dict[str, float], required: list[str] | dict) -> list[dict]:
    """Compare current levels vs required (default 80) for a target role."""
    if isinstance(required, str):
        try:
            required = json.loads(required)
        except (ValueError, TypeError):
            required = []
    if isinstance(required, dict):
        req_map = {str(k): float(v) for k, v in required.items()}
    else:
        req_map = {str(s): 80.0 for s in (required or [])}
    lookup = {k.lower(): v for k, v in student_skills.items()}
    gaps = []
    for name, req in req_map.items():
        cur = float(lookup.get(name.lower(), 25.0))
        gaps.append({"name": name, "current": round(cur, 1), "required": req, "gap": round(req - cur, 1)})
    return sorted(gaps, key=lambda g: g["gap"], reverse=True)


def job_match_score(student_skills: set[str], job_skills: list[str]) -> float:
    if not job_skills:
        return 50.0
    have = {s.lower() for s in student_skills}
    need = [s.lower() for s in job_skills]
    matched = [s for s in need if s in have]
    return round(len(matched) / len(need) * 100, 1)
