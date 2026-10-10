"""Deterministic MOCK_AI_MODE provider.

Generates realistic, deterministic responses so the whole platform is
demonstrable without any API key or network access.
"""
import hashlib
import json

from app.ai.base import AIProvider

MISSING_SECTIONS = ["Summary", "Projects", "Certifications", "Achievements", "Quantifiable metrics"]

SKILL_NAMES = [
    "python", "javascript", "typescript", "java", "c++", "sql", "mysql",
    "postgresql", "mongodb", "react", "node.js", "express", "django",
    "flask", "angular", "html", "css", "tailwind", "git", "github", "docker",
    "kubernetes", "aws", "azure", "linux", "ci/cd", "machine learning",
    "deep learning", "tensorflow", "pytorch", "pandas", "numpy", "scikit-learn",
    "data analysis", "data science", "excel", "power bi", "tableau", "communication",
    "teamwork", "leadership", "problem solving", "critical thinking",
]


def _found_skills(text: str) -> list[str]:
    lower = text.lower()
    return [s for s in SKILL_NAMES if s in lower]


class MockAIProvider(AIProvider):
    name = "mock"

    def complete(self, prompt: str, system: str = "", max_tokens: int = 1200) -> str:
        p = (system + "\n" + prompt).lower()
        if "ats_score" in p or "##resume_analysis##" in p:
            return self._resume_analysis(prompt)
        if "job_match" in p or "##job_match##" in p:
            return self._job_match(prompt)
        if "career_recommendations" in p or "##recommendations##" in p:
            return self._career_recommendations(prompt)
        if "skill_gaps" in p or "##skill_gaps##" in p:
            return self._skill_gaps(prompt)
        if "roadmap" in p or "##roadmap##" in p:
            return self._roadmap(prompt)
        if "interview_feedback" in p or "##interview_feedback##" in p:
            return self._interview_feedback(prompt)
        if "interview_questions" in p or "##interview_questions##" in p:
            return self._interview_questions(prompt)
        if "interview_report" in p or "##interview_report##" in p:
            return self._interview_report(prompt)
        if "project_recommendations" in p or "##project_recommendations##" in p:
            return self._projects()
        if "chat" in p or "assistant" in p or "what should i learn" in p or "##chat##" in p:
            return self._chat(prompt)
        return (
            f"Based on your student profile, I recommend focusing on high-impact skills "
            f"aligned with your target role. Start with Python + SQL fundamentals, build a "
            f"portfolio project, practice 2 mock interviews weekly, and apply to 3 curated "
            f"internships. Track everything here on CareerLens AI!"
        )

    def _resume_analysis(self, prompt: str) -> str:
        text = prompt.lower()
        found = _found_skills(text)
        missing = [s for s in MISSING_SECTIONS if s.lower() not in text]
        if len(found) > 4:
            kw_score = 78 + (len(found) % 3) * 5
        elif found:
            kw_score = 55 + len(found) * 4
        else:
            kw_score = 38
        sk = min(90.0, 40 + (len(set(text.split())) / 200) * 50)
        exp = 70 if ("intern" in text or "experience" in text) else 45
        proj = 78 if "project" in text else 40
        edu = 80 if ("college" in text or "university" in text or "b.tech" in text) else 50
        fmt = 82 if (text.count("\n") > 10 and text.count(",") > 4) else 62
        align = min(90.0, 50 + len(found) * 3)
        ats = round(0.22 * min(100, kw_score) + 0.18 * min(100, sk) + 0.16 * exp
                    + 0.14 * proj + 0.08 * edu + 0.10 * fmt + 0.12 * align, 1)

        strengths = []
        if found:
            strengths.append(f"Detected {len(found)} relevant keywords: {', '.join(found[:6])}.")
        if "project" in text:
            strengths.append("Projects section present - recruiters value demonstrated work.")
        if "experience" in text:
            strengths.append("Work/internship experience included.")

        improvements = []
        if missing:
            improvements.append("Add missing section(s): " + ", ".join(missing) + ".")
        improvements.append("Quantify achievements with numbers (%, scale, impact).")
        improvements.append("Use stronger action verbs (Built, Led, Optimized).")
        if not found:
            improvements.append("Add relevant technical keywords from target job descriptions.")

        recs = [
            "Add REST API under technical skills if you built any integration.",
            "Start bullet points with action verbs and include metrics.",
            "Mirror keywords found in target job descriptions.",
            "Keep one page for 0-3 years experience.",
        ]
        if missing:
            recs.insert(0, f"Add the missing section(s): {', '.join(missing[:2])}.")

        return json.dumps({
            "ats_score": ats,
            "match_score": round(align, 1),
            "categories": {
                "keywords": round(min(100, kw_score), 1),
                "skills": round(min(100, sk), 1),
                "experience": round(exp, 1),
                "projects": round(proj, 1),
                "education": round(edu, 1),
                "formatting": round(fmt, 1),
                "job_alignment": round(align, 1),
            },
            "strengths": strengths[:4],
            "improvements": improvements[:5],
            "missing_sections": missing[:5],
            "keywords": found[:12],
            "recommendations": recs[:5],
            "summary": (
                f"Strong foundation with {len(found)} matched skills; focus on impact "
                f"quantification and adding a clear Projects section to reach 90+."
            ),
        })

    def _job_match(self, prompt: str) -> str:
        jd, resume_text = _split_jd_resume(prompt)
        jd_lower, resume_lower = jd.lower(), resume_text.lower()
        jd_skills = [s for s in SKILL_NAMES if s in jd_lower]
        matched = [s for s in jd_skills if s in resume_lower]
        missing = [s for s in jd_skills if s not in resume_lower]
        if not jd_skills:
            pct = 92.0
        else:
            pct = round((len(matched) / len(jd_skills)) * 100, 1)
        return json.dumps({
            "match_score": max(15.0, min(98.0, pct)),
            "matching_skills": matched[:10],
            "missing_skills": missing[:8] or ["Advanced " + s for s in (jd_skills or ["REST API"])[:3]],
            "recommended_keywords": missing[:6] or ["REST API", "System design", "Testing"],
            "experience_match": "Good" if "intern" in resume_lower else "Partial",
            "education_match": "Yes" if ("b.tech" in resume_lower or "college" in resume_lower) else "Partial",
            "role_suitability": "High" if pct >= 70 else "Medium" if pct >= 45 else "Low",
            "why_match": [
                "You demonstrate the core programming skills requested.",
                "Your project experience aligns with the role scope.",
            ] if matched else ["Your fundamentals match entry-level expectations."],
            "why_not_match": [
                "Some required technologies are missing from your resume.",
                "Position prefers hands-on experience with their stack.",
            ],
            "improve_before_apply": [
                "Add the missing technologies as skill keywords.",
                "Tailor your summary to this specific JD.",
                "Show a relevant project in the requested domain.",
            ],
            "application_recommendation": "Apply now" if pct >= 65 else "Improve then apply",
        })

    def _career_recommendations(self, prompt: str) -> str:
        lower = prompt.lower()
        if "ml" in lower or "machine learning" in lower or "ai" in lower:
            target = "AI/ML Engineer"
        elif "data" in lower:
            target = "Data Analyst"
        else:
            target = "Software Developer"
        return json.dumps({
            "recommended": [target, "Software Developer", "Cloud Engineer"][:2],
            "scores": {target: 87, "Software Developer": 82, "Cloud Engineer": 71},
        })

    def _skill_gaps(self, prompt: str) -> str:
        target = "Data Analyst" if "data" in prompt.lower() else "Full Stack Developer"
        if target == "Full Stack Developer":
            base = [
                {"name": "Python", "current": 60, "required": 85},
                {"name": "SQL", "current": 55, "required": 80},
                {"name": "JavaScript", "current": 45, "required": 80},
                {"name": "React", "current": 35, "required": 75},
                {"name": "Node.js / Backend", "current": 30, "required": 75},
                {"name": "Git", "current": 70, "required": 80},
            ]
        else:
            base = [
                {"name": "Data Analysis", "current": 50, "required": 85},
                {"name": "Statistics", "current": 40, "required": 75},
                {"name": "Python", "current": 65, "required": 85},
                {"name": "SQL", "current": 55, "required": 80},
                {"name": "Visualization", "current": 45, "required": 75},
                {"name": "Excel", "current": 70, "required": 80},
            ]
        recs = [
            f"Prioritize the biggest gaps for {target}: build 2 hands-on projects using them.",
            "Complete one structured course per top-3 gap this month.",
            "Re-assess in 30 days by updating skill levels after practice.",
        ]
        return json.dumps({"target": target, "gaps": base, "recommendations": recs})

    def _roadmap(self, prompt: str) -> str:
        lower = prompt.lower()
        if "data" in lower and "ai" not in lower and "ml" not in lower:
            target = "Data Analyst"
        elif "ai" in lower or "ml" in lower or "machine" in lower:
            target = "AI/ML Engineer"
        else:
            target = "Software Developer"
        if target == "AI/ML Engineer":
            months = [
                ("Python + Statistics & Linear Algebra", "learn"),
                ("Machine Learning fundamentals", "learn"),
                ("Deep Learning + NLP basics", "learn"),
                ("ML project: end-to-end pipeline", "project"),
                ("MLOps + deployment", "learn"),
                ("Interview prep + portfolio", "interview"),
            ]
        elif target == "Data Analyst":
            months = [
                ("Excel + SQL foundations", "learn"),
                ("Python for data (Pandas, NumPy)", "learn"),
                ("Visualization (Power BI / Tableau)", "learn"),
                ("Statistics + A/B testing basics", "learn"),
                ("Portfolio: 3 analysis projects", "project"),
                ("Interview prep + case studies", "interview"),
            ]
        else:
            months = [
                ("Programming fundamentals (Python/JS)", "learn"),
                ("Data structures & algorithms", "learn"),
                ("Backend + databases", "learn"),
                ("Frontend + API integration", "learn"),
                ("Build a full-stack project", "project"),
                ("Interview preparation + applying", "interview"),
            ]
        items = [
            {
                "month": i + 1,
                "title": t,
                "description": f"Month {i+1}: focus on '{t}' for the {target} track.",
                "category": c,
                "status": "completed" if i == 0 else "pending",
            }
            for i, (t, c) in enumerate(months)
        ]
        return json.dumps({"target": target, "total_months": 6, "items": items})

    def _interview_questions(self, prompt: str) -> str:
        lower = prompt.lower()
        role = "Software Developer"
        mapping = {
            "data": "Data Analyst", "ml": "AI/ML Engineer", "ai": "AI/ML Engineer",
            "frontend": "Frontend Developer", "backend": "Backend Developer",
            "cloud": "Cloud Engineer", "devops": "DevOps Engineer",
            "full stack": "Full Stack Developer",
        }
        for key, mapped in mapping.items():
            if key in lower:
                role = mapped
                break
        qs = [
            {"category": "hr", "question_type": "open",
             "question": f"Tell me about yourself and why you want the {role} role."},
            {"category": "technical", "question_type": "open",
             "question": f"Explain one data structure you would use to build an in-memory cache for a {role} feature."},
            {"category": "behavioral", "question_type": "open",
             "question": "Describe a time you faced a difficult problem in a team project. (Use STAR)"},
            {"category": "coding", "question_type": "coding",
             "question": "Write a function to reverse a string and check if a string is a palindrome."},
            {"category": "role", "question_type": "open",
             "question": f"What are the most important skills for {role} and which of them are your strengths?"},
        ]
        return json.dumps({"role": role, "difficulty": "medium", "questions": qs})

    def _interview_feedback(self, prompt: str) -> str:
        seed = hashlib.md5(prompt.encode("utf-8")).hexdigest()
        base = 60 + (int(seed, 16) % 35)
        return json.dumps({
            "score": base,
            "categories": {
                "communication": min(95, base + 5),
                "technical": base,
                "confidence": min(95, base + 10),
                "relevance": max(40, base - 5),
                "structure": min(95, base + 8),
            },
            "feedback": (
                "Good effort! Structure your answer with STAR (Situation, Task, Action, Result). "
                "Add concrete numbers and be more specific about tools/technologies you used."
            ),
            "improved_answer": (
                "Stronger version: 'In my last semester project (Situation), I owned the API layer "
                "(Task). I designed REST endpoints with Node.js and integrated them with the React "
                "frontend (Action), cutting load time by 40% and demoing it successfully (Result).'"
            ),
        })

    def _interview_report(self, prompt: str) -> str:
        return json.dumps({
            "communication": 76, "technical": 72, "confidence": 80,
            "relevance": 74, "structure": 78, "overall": 75,
            "summary": (
                "Strong fundamentals and confident communication. Focus on structured, "
                "STAR-based answers and deeper technical depth for your target role."
            ),
            "next_steps": [
                "Practice 2 more mock interviews per week.",
                "Review core DS/Algo patterns.",
                "Build a second portfolio project.",
            ],
        })

    def _projects(self) -> str:
        return json.dumps({
            "projects": [
                {
                    "title": "Smart Resume Analyzer",
                    "difficulty": "Intermediate",
                    "category": "web",
                    "technologies": ["React", "FastAPI", "SQLite"],
                    "problem_statement": "Students can't tell if their resume is ATS-friendly.",
                    "features": ["Upload resume", "Score ATS", "Get improvement tips"],
                    "learning_outcomes": ["File parsing", "API design", "UI/UX"],
                    "estimated_duration": "3-4 weeks",
                    "resume_value": "High",
                    "github_checklist": ["Parsing", "Scoring engine", "Report UI", "Deploy"],
                },
                {
                    "title": "Skills Gap Dashboard",
                    "difficulty": "Advanced",
                    "category": "data",
                    "technologies": ["Python", "Pandas", "Recharts"],
                    "problem_statement": "Professionals waste time learning the wrong skills.",
                    "features": ["Compare skills", "Visual gaps", "Recommendations"],
                    "learning_outcomes": ["Data viz", "Analytics", "Recommendations"],
                    "estimated_duration": "4-5 weeks",
                    "resume_value": "High",
                    "github_checklist": ["Data model", "Comparison", "Charts", "Docs"],
                },
            ]
        })

    def _chat(self, prompt: str) -> str:
        lower = prompt.lower()
        if "skill" in lower:
            topic = "skills to learn next"
        elif "resume" in lower:
            topic = "resume improvements"
        elif "interview" in lower:
            topic = "interview preparation"
        elif "project" in lower:
            topic = "projects to build"
        elif "career" in lower or "job" in lower:
            topic = "career paths"
        else:
            topic = "career growth"
        return (
            f"Great question! Based on your profile, here is what I recommend for {topic}: "
            f"1) Focus on the biggest skill gaps first - pick one and practice daily. "
            f"2) Build a small portfolio project to apply it within 2 weeks. "
            f"3) Set a roadmap goal on CareerLens and track weekly. "
            f"4) Take a mock interview after 2 weeks of practice to validate progress. "
            f"Want me to suggest study resources or a specific project next?"
        )


def _split_jd_resume(prompt: str) -> tuple[str, str]:
    marker = prompt.find("[RESUME]")
    if marker != -1:
        return prompt[:marker], prompt[marker + len("[RESUME]"):]
    marker_jd = prompt.find("[JD]")
    if marker_jd != -1:
        return prompt[marker_jd + len("[JD]"):], prompt[:marker_jd]
    mid = len(prompt) // 2
    return prompt[:mid], prompt[mid:]


def get_mock_provider() -> MockAIProvider:
    return MockAIProvider()
