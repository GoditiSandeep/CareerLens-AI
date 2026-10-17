"""Core API coverage: dashboard, careers, skills, jobs, roadmap, practice, projects."""


def test_dashboard(client, auth_headers):
    r = client.get("/dashboard", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "career_readiness" in body
    assert "next_actions" in body


def test_careers_list(client):
    r = client.get("/careers")
    assert r.status_code == 200
    assert len(r.json()) >= 10


def test_career_recommendations(client, auth_headers):
    r = client.get("/careers/recommendations", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()) >= 5


def test_skills_and_gaps(client, auth_headers):
    assert client.get("/skills").status_code == 200
    r = client.get("/skills/gaps?target=Data Analyst", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["target"] == "Data Analyst"


def test_jobs_and_applications(client, auth_headers):
    jobs = client.get("/jobs", headers=auth_headers)
    assert jobs.status_code == 200
    assert len(jobs.json()) >= 10
    job_id = jobs.json()[0]["id"]
    assert client.post(f"/jobs/{job_id}/save", headers=auth_headers).status_code == 200
    app = client.post(f"/jobs/{job_id}/apply", headers=auth_headers)
    assert app.status_code == 200
    assert client.get("/applications", headers=auth_headers).status_code == 200


def test_roadmap_flow(client, auth_headers):
    gen = client.post("/roadmap/generate", headers=auth_headers, json={
        "target_role": "Data Analyst", "months": 2})
    assert gen.status_code == 201
    roadmap_id = gen.json()["id"]
    assert roadmap_id > 0
    item_id = gen.json()["items"][0]["id"]
    upd = client.put(f"/roadmap/items/{item_id}", headers=auth_headers, json={
        "status": "completed"})
    assert upd.status_code == 200


def test_resume_upload_and_analyze(client, auth_headers):
    up = client.post("/resumes/upload", headers=auth_headers, files={
        "file": ("resume.txt", b"Python developer skilled in SQL and React. Projects: dashboard.")})
    assert up.status_code == 201, up.text
    resume_id = up.json()["id"]
    analysis = client.post(f"/resumes/{resume_id}/analyze", headers=auth_headers)
    assert analysis.status_code == 200
    assert analysis.json()["ats_score"] >= 0
    match = client.post(f"/resumes/{resume_id}/job-match", headers=auth_headers, json={
        "job_description": "We need a Python developer with SQL and React for dashboards."})
    assert match.status_code == 200
    assert match.json()["match_score"] >= 0


def test_interview_flow(client, auth_headers):
    start = client.post("/interviews/start", headers=auth_headers, json={
        "role": "Data Analyst", "difficulty": "easy", "interview_type": "practice"})
    assert start.status_code == 200
    session_id = start.json()["id"]
    ans = client.post(f"/interviews/{session_id}/answer", headers=auth_headers, json={
        "answer": "I built a sales dashboard using SQL and Power BI that cut reporting time."})
    assert ans.status_code == 200
    assert client.get(f"/interviews/{session_id}/report", headers=auth_headers).status_code == 200


def test_aptitude_and_coding(client, auth_headers):
    questions = client.get("/aptitude/questions", headers=auth_headers)
    assert questions.status_code == 200
    q = questions.json()[0]
    sub = client.post("/aptitude/submit", headers=auth_headers, json={
        "question_id": q["id"], "selected_index": 0})
    assert sub.status_code == 200
    coding = client.get("/coding/questions", headers=auth_headers)
    assert coding.status_code == 200
    cq = coding.json()[0]
    run = client.post(f"/coding/{cq['id']}/submit", headers=auth_headers, json={
        "code": "def two_sum(nums, target): return [0, 1]", "language": "python"})
    assert run.status_code == 200


def test_chat(client, auth_headers):
    r = client.post("/ai/chat", headers=auth_headers, json={
        "message": "What should I learn next?"})
    assert r.status_code == 200
    assert len(r.json()["reply"]) > 20


def test_project_recommendations_shape(client, auth_headers):
    """The Projects page renders features/checklists — the API must send them."""
    r = client.get("/projects/recommendations", headers=auth_headers)
    assert r.status_code == 200
    ideas = r.json()
    assert len(ideas) >= 1
    first = ideas[0]
    for key in (
        "title", "technologies", "features", "github_checklist",
        "resume_value", "learning_outcomes", "estimated_duration",
    ):
        assert key in first, f"missing field: {key}"
    assert isinstance(first["features"], list)
    assert isinstance(first["github_checklist"], list)
