"""Shared pytest fixtures — fresh SQLite DB per test session."""
import warnings

warnings.filterwarnings("ignore")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401  (register models)
from app.database.db import Base, get_db
from app.main import app
from app.services.seeder import seed_all


@pytest.fixture(scope="session")
def testing_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSession()
    seed_all(db)
    db.close()
    return TestingSession


@pytest.fixture(scope="session")
def client(testing_session):
    TestingSession = testing_session

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def auth_headers(client):
    """A registered student. The password is generated at runtime so no
    throwaway credential literal is committed to source or Git."""
    import secrets

    password = "S-" + secrets.token_urlsafe(18)  # test-only, ephemeral
    r = client.post("/auth/register", json={
        "full_name": "Test Student", "email": "test@careerlens.ai",
        "password": password, "branch": "CSE"})
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def demo_headers(client):
    r = client.post("/auth/login", json={
        "email": "demo@careerlens.ai", "password": "Demo@12345"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def admin_headers(client, testing_session):
    """Administrator created through the real bootstrap code path.

    The password is generated randomly at runtime and never committed,
    so no credential literal lives in source or Git history.
    """
    import secrets

    from app.cli.create_admin import EXIT_OK, bootstrap_admin

    admin_email = "admin@careerlens.ai"
    admin_password = "T-" + secrets.token_urlsafe(18)  # test-only, ephemeral
    db = testing_session()
    try:
        code, msg = bootstrap_admin(
            db, email=admin_email,
            full_name="Godithi Sandeep", password=admin_password)
        assert code == EXIT_OK, msg
    finally:
        db.close()
    r = client.post("/auth/login", json={
        "email": admin_email, "password": admin_password})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["role"] == "admin", body
    return {"Authorization": f"Bearer {body['access_token']}"}
