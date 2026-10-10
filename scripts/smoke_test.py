"""
CareerLens AI — end-to-end smoke test (stdlib only).

Verifies the core user journey against a running backend:
health -> register -> login -> profile -> skills -> careers -> roadmap ->
jobs -> applications -> resume upload/analyze/match -> interview ->
aptitude -> coding -> AI chat -> dashboard.

Usage:
    python scripts/smoke_test.py                # http://localhost:8000
    python scripts/smoke_test.py http://localhost:5173   # through Vite proxy
"""
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
TOKEN = None
FAILURES = []


def call(method, path, body=None, raw=False, headers=None):
    url = BASE + path
    data = None
    hdrs = {"Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    if TOKEN:
        hdrs["Authorization"] = f"Bearer {TOKEN}"
    if body is not None:
        if isinstance(body, bytes):
            data = body
        else:
            data = json.dumps(body).encode()
            hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = resp.read()
            if raw:
                return resp.status, payload
            return resp.status, json.loads(payload or b"{}")
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            return e.code, json.loads(payload or b"{}")
        except json.JSONDecodeError:
            return e.code, {"detail": payload.decode(errors="replace")[:300]}


def check(name, cond, info=""):
    print(f"{'OK  ' if cond else 'FAIL'} {name} {info}")
    if not cond:
        FAILURES.append(name)


def main():
    global TOKEN

    code, body = call("GET", "/health")
    check("health", code == 200 and body.get("status") == "healthy")

    email = f"smoke_{uuid.uuid4().hex[:8]}@example.com"
    code, body = call("POST", "/auth/register", {
        "full_name": "Smoke Tester", "email": email, "password": "Smoke@1234",
        "degree": "B.Tech", "branch": "CSE",
    })
    check("register", code in (200, 201) and "access_token" in body, f"({code})")
    if code not in (200, 201):
        print("   detail:", body)
        return 1
    TOKEN = body["access_token"]

    code, body = call("POST", "/auth/login", {"email": email, "password": "Smoke@1234"})
    check("login", code == 200 and "access_token" in body, f"({code})")

    code, body = call("GET", "/auth/me")
    check("auth/me", code == 200 and body.get("email") == email, f"({code})")

    code, body = call("POST", "/profile/onboarding", {
        "skills": [{"name": "Python", "level": 60}, {"name": "SQL", "level": 45}],
        "desired_roles": ["Backend Developer"],
    })
    check("onboarding", code == 200, f"({code})")

    code, body = call("PUT", "/profile", {"career_goals": "Become a backend engineer"})
    check("profile update", code == 200, f"({code})")

    code, body = call("GET", "/dashboard")
    check("dashboard", code == 200 and "career_readiness" in body, f"({code})")

    code, body = call("GET", "/careers")
    n = len(body) if isinstance(body, list) else "?"
    check("careers list", code == 200 and n != 0, f"({code}, {n})")

    code, body = call("GET", "/careers/recommendations")
    check("career recommendations", code == 200 and isinstance(body, list), f"({code})")

    code, body = call("GET", "/skills/gaps?target=" + urllib.parse.quote("Software Developer"))
    check("skill gaps", code == 200 and "gaps" in body, f"({code})")

    code, body = call("POST", "/skills", {"name": "Docker", "level": 40})
    check("add skill", code == 200, f"({code})")

    code, body = call("POST", "/roadmap/generate",
                      {"target_role": "Software Developer", "months": 3})
    check("roadmap generate", code in (200, 201) and "items" in body, f"({code})")
    item_id = body["items"][0]["id"] if isinstance(body, dict) and body.get("items") else None
    if item_id:
        code, _ = call("PUT", f"/roadmap/items/{item_id}", {"status": "completed"})
        check("roadmap item update", code == 200, f"({code})")

    code, body = call("GET", "/jobs")
    check("jobs list", code == 200 and isinstance(body, list) and len(body) > 0, f"({code})")
    if isinstance(body, list) and body:
        jid = body[0]["id"]
        code, _ = call("POST", f"/jobs/{jid}/save")
        check("job save", code == 200, f"({code})")
        code, _ = call("POST", f"/jobs/{jid}/apply")
        check("job apply", code == 200, f"({code})")

    code, body = call("POST", "/applications", {
        "company": "ProbeCo", "role": "SDE Intern", "status": "wishlist",
    })
    check("create application", code in (200, 201), f"({code})")
    code, apps = call("GET", "/applications")
    if code == 200 and apps:
        code, _ = call("PUT", f"/applications/{apps[0]['id']}", {"status": "applied"})
        check("application move", code == 200, f"({code})")

    # Resume: upload a text resume, analyze, job-match
    resume_text = (
        b"John Doe\nEducation: B.Tech CSE 2026\nSkills: Python SQL REST APIs\n"
        b"Projects: Inventory dashboard (Flask, PostgreSQL)\n"
        b"Experience: Intern at StartupX\nContact: john@test.local\n"
    )
    boundary = "----smokeboundary"
    part = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; "
            f"filename=\"resume.txt\"\r\nContent-Type: text/plain\r\n\r\n").encode()
    multipart = part + resume_text + f"\r\n--{boundary}--\r\n".encode()
    code, body = call("POST", "/resumes/upload", multipart, headers={
        "Content-Type": f"multipart/form-data; boundary={boundary}"})
    check("resume upload", code in (200, 201) and "id" in body, f"({code})")
    if code in (200, 201):
        rid = body["id"]
        code, an = call("POST", f"/resumes/{rid}/analyze")
        check("resume analyze", code == 200 and "ats_score" in an, f"({code})")
        code, _ = call("GET", f"/resumes/{rid}/analysis")
        check("resume analysis fetch", code == 200, f"({code})")
        code, jm = call("POST", f"/resumes/{rid}/job-match", {
            "job_description": "Looking for a Python developer with SQL and REST API experience for dashboards."})
        check("resume job match", code == 200 and "match_score" in jm, f"({code})")

    code, body = call("POST", "/interviews/start", {
        "role": "Backend Developer", "difficulty": "medium", "interview_type": "practice"})
    check("interview start", code == 200 and body.get("questions"), f"({code})")
    if code == 200:
        code, ans = call("POST", f"/interviews/{body['id']}/answer", {
            "answer": "In my internship I redesigned a slow SQL query and cut page load "
                      "time by 40 percent, which taught me to measure before optimizing."})
        check("interview answer", code == 200 and "score" in ans, f"({code})")

    code, qs = call("GET", "/aptitude/questions")
    check("aptitude questions", code == 200 and isinstance(qs, list) and len(qs) > 0, f"({code})")
    if code == 200 and qs:
        code, res = call("POST", "/aptitude/submit",
                         {"question_id": qs[0]["id"], "selected_index": 0})
        check("aptitude submit", code == 200 and "correct" in res, f"({code})")

    code, cq = call("GET", "/coding/questions")
    check("coding questions", code == 200 and isinstance(cq, list) and len(cq) > 0, f"({code})")
    if code == 200 and cq:
        code, res = call("POST", f"/coding/{cq[0]['id']}/submit", {
            "code": "def solve():\n    # handle expected value 42\n    return 42\n",
            "language": "python"})
        check("coding submit", code == 200 and "passed" in res, f"({code})")

    code, res = call("POST", "/ai/chat", {"message": "How do I prepare for placements?"})
    check("ai chat", code == 200 and res.get("reply"), f"({code})")

    code, hist = call("GET", "/ai/chat/history")
    check("chat history", code == 200 and isinstance(hist, list), f"({code})")

    code, body = call("GET", "/readiness")
    check("readiness", code == 200 and "score" in body, f"({code})")

    code, body = call("POST", "/achievements", {"title": "Hackathon Finalist"})
    check("achievement add", code in (200, 201), f"({code})")

    code, body = call("POST", "/certifications", {"name": "Python 101", "issuer": "OpenCourse"})
    check("certification add", code in (200, 201), f"({code})")

    code, body = call("GET", "/profile/export")
    check("profile export", code == 200, f"({code})")

    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILED: {FAILURES}")
        return 1
    print("ALL SMOKE CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
