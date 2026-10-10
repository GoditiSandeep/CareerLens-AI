"""Phase A tests — roles, admin authorization, bootstrap safety.

Covers: registration can never create an admin, students are blocked from
every admin endpoint, missing/invalid auth, admin login, password hashing,
self-lockout protection, career/job management, and secret-free responses.
"""
import warnings

warnings.filterwarnings("ignore")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (register models)
from app.cli.create_admin import (
    EXIT_CONFLICT, EXIT_ERROR, EXIT_OK, bootstrap_admin,
)
from app.core.security import verify_password
from app.database.db import Base
from app.models.user import User

ADMIN_ENDPOINTS = [
    "/admin/stats",
    "/admin/users",
    "/admin/settings",
    "/admin/careers",
    "/admin/jobs",
]


@pytest.fixture()
def local_db():
    """Independent in-memory DB for bootstrap tests (does not touch app DB)."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    yield db
    db.close()


def test_register_cannot_create_admin(client):
    r = client.post("/auth/register", json={
        "full_name": "Sneaky Student", "email": "sneaky@careerlens.ai",
        "password": "Sneak@12345", "role": "admin", "is_demo": True,
    })
    assert r.status_code == 201, r.text
    user = r.json()["user"]
    assert user["role"] == "student", "registration must never set role"
    assert user["is_demo"] is False


def test_missing_auth_returns_401(client):
    assert client.get("/admin/stats").status_code == 401


def test_invalid_token_returns_401(client):
    r = client.get("/admin/stats",
                   headers={"Authorization": "Bearer not.a.token"})
    assert r.status_code == 401


def test_student_blocked_from_all_admin_endpoints(client, auth_headers):
    for path in ADMIN_ENDPOINTS:
        r = client.get(path, headers=auth_headers)
        assert r.status_code == 403, f"{path} -> {r.status_code}"
    r = client.patch("/admin/users/1", headers=auth_headers,
                     json={"role": "admin"})
    assert r.status_code == 403
    r = client.post("/admin/careers", headers=auth_headers,
                    json={"name": "Hacked Path", "description": "x"})
    assert r.status_code == 403


def test_admin_login_and_full_access(client, admin_headers):
    for path in ADMIN_ENDPOINTS:
        r = client.get(path, headers=admin_headers)
        assert r.status_code == 200, f"{path} -> {r.text}"


def test_admin_stats_shape_and_no_hashes(client, admin_headers):
    r = client.get("/admin/stats", headers=admin_headers)
    body = r.json()
    for section in ("users", "activity", "content", "recent_users"):
        assert section in body
    assert body["users"]["total"] >= 1
    assert body["users"]["admins"] >= 1
    assert body["content"]["career_paths"] >= 1
    assert "hashed_password" not in r.text
    assert "hashed_password" not in client.get(
        "/admin/users", headers=admin_headers).text


def test_admin_cannot_demote_or_disable_self(client, admin_headers):
    me = client.get("/auth/me", headers=admin_headers).json()
    r = client.patch(f"/admin/users/{me['id']}", headers=admin_headers,
                     json={"role": "student"})
    assert r.status_code == 400
    r = client.patch(f"/admin/users/{me['id']}", headers=admin_headers,
                     json={"is_active": False})
    assert r.status_code == 400
    me2 = client.get("/auth/me", headers=admin_headers).json()
    assert me2["role"] == "admin"


def test_bootstrap_creates_admin_with_hashed_password(local_db):
    code, msg = bootstrap_admin(
        local_db, email="Owner@Example.com",
        full_name="Godithi Sandeep", password="Sup3rSecret!")
    assert code == EXIT_OK, msg
    user = local_db.query(User).filter_by(email="owner@example.com").one()
    assert user.role == "admin"
    assert user.hashed_password != "Sup3rSecret!"
    assert verify_password("Sup3rSecret!", user.hashed_password)
    assert "Sup3rSecret!" not in msg


def test_bootstrap_rerun_is_safe(local_db):
    assert bootstrap_admin(
        local_db, email="a@example.com", full_name="Admin One",
        password="Passw0rd!1")[0] == EXIT_OK
    first_hash = local_db.query(User).filter_by(
        email="a@example.com").one().hashed_password
    # Rerun with a DIFFERENT password must not reset anything.
    code, msg = bootstrap_admin(
        local_db, email="a@example.com", full_name="Admin One",
        password="Different!2")
    assert code == EXIT_OK
    assert "No changes were made" in msg
    same = local_db.query(User).filter_by(email="a@example.com").one()
    assert same.hashed_password == first_hash


def test_bootstrap_refuses_to_promote_student(local_db):
    student = User(full_name="Student", email="stu@example.com",
                   hashed_password="x", role="student")
    local_db.add(student)
    local_db.commit()
    code, msg = bootstrap_admin(
        local_db, email="stu@example.com", full_name="Fake Admin",
        password="Whatever!1")
    assert code == EXIT_CONFLICT
    assert "NOT silently promote" in msg
    local_db.refresh(student)
    assert student.role == "student"


def test_bootstrap_rejects_weak_password(local_db):
    code, msg = bootstrap_admin(
        local_db, email="weak@example.com", full_name="Weak Admin",
        password="short")
    assert code == EXIT_ERROR
    assert local_db.query(User).filter_by(
        email="weak@example.com").count() == 0


def test_public_register_has_no_admin_route(client):
    # There is no admin registration endpoint at all.
    r = client.post("/admin/register", json={
        "full_name": "Nope", "email": "nope@example.com",
        "password": "Whatever!1"})
    assert r.status_code in (404, 405, 422)


def test_settings_endpoint_hides_secrets(client, admin_headers):
    import app.core.config as cfg
    r = client.get("/admin/settings", headers=admin_headers)
    body = r.json()
    assert cfg.settings.SECRET_KEY not in r.text
    assert body["ai"]["mode"].startswith(("mock", "live"))
    assert body["database_backend"] in ("sqlite", "postgresql")


def test_career_crud_as_admin(client, admin_headers):
    r = client.post("/admin/careers", headers=admin_headers, json={
        "name": "Test Career Path", "category": "QA",
        "description": "Created by test",
        "required_skills": ["Testing", "Automation"],
    })
    assert r.status_code == 201, r.text
    career_id = r.json()["id"]
    # Duplicate rejected.
    r2 = client.post("/admin/careers", headers=admin_headers, json={
        "name": "test career path", "description": "dup"})
    assert r2.status_code == 400
    # Update.
    r3 = client.patch(f"/admin/careers/{career_id}",
                      headers=admin_headers,
                      json={"demand_level": "Very High"})
    assert r3.status_code == 200
    assert r3.json()["demand_level"] == "Very High"
    # Delete.
    r4 = client.delete(f"/admin/careers/{career_id}",
                       headers=admin_headers)
    assert r4.status_code == 200
    assert client.get("/admin/careers", headers=admin_headers).status_code == 200


def test_job_crud_and_sample_labelling(client, admin_headers):
    # Seeded jobs must be labelled as sample data.
    jobs = client.get("/admin/jobs", headers=admin_headers).json()
    assert jobs, "expected seeded jobs"
    assert any(j["is_sample"] for j in jobs)
    # Admin-created listings are not samples.
    r = client.post("/admin/jobs", headers=admin_headers, json={
        "title": "Test Engineer", "company": "TestCo",
        "description": "Real-looking listing created by admin"})
    assert r.status_code == 201, r.text
    assert r.json()["is_sample"] is False
    job_id = r.json()["id"]
    r2 = client.patch(f"/admin/jobs/{job_id}", headers=admin_headers,
                      json={"is_active": False})
    assert r2.status_code == 200 and r2.json()["is_active"] is False
    r3 = client.delete(f"/admin/jobs/{job_id}", headers=admin_headers)
    assert r3.status_code == 200


def test_disabled_student_cannot_login_or_use_token(client, admin_headers):
    r = client.post("/auth/register", json={
        "full_name": "Temp Student", "email": "temp-disabled@careerlens.ai",
        "password": "Temp@12345"})
    assert r.status_code == 201
    token = r.json()["access_token"]
    student_id = r.json()["user"]["id"]

    # Admin disables the account.
    r2 = client.patch(f"/admin/users/{student_id}", headers=admin_headers,
                      json={"is_active": False})
    assert r2.status_code == 200 and r2.json()["is_active"] is False

    # Login is refused with a clear error.
    r3 = client.post("/auth/login", json={
        "email": "temp-disabled@careerlens.ai", "password": "Temp@12345"})
    assert r3.status_code == 403

    # Existing token stops working too (backend checks is_active).
    r4 = client.get("/auth/me",
                    headers={"Authorization": f"Bearer {token}"})
    assert r4.status_code == 401

    # Cleanup so later suites don't see a disabled account unexpectedly.
    client.patch(f"/admin/users/{student_id}", headers=admin_headers,
                 json={"is_active": True})

