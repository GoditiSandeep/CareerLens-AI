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
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSession()
    seed_all(db)
    db.close()

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
    r = client.post("/auth/register", json={
        "full_name": "Test Student", "email": "test@careerlens.ai",
        "password": "Test@12345", "branch": "CSE"})
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def demo_headers(client):
    r = client.post("/auth/login", json={
        "email": "demo@careerlens.ai", "password": "Demo@12345"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
