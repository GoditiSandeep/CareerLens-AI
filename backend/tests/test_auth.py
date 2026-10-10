"""Auth + health tests."""


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "healthy"}


def test_demo_login(demo_headers):
    assert demo_headers["Authorization"].startswith("Bearer ")


def test_register_duplicate_rejected(client):
    payload = {"full_name": "Dup", "email": "dup@careerlens.ai",
               "password": "Dup@12345"}
    assert client.post("/auth/register", json=payload).status_code == 201
    assert client.post("/auth/register", json=payload).status_code == 400


def test_me_requires_auth(client):
    assert client.get("/auth/me").status_code in (401, 403)


def test_me_with_auth(client, auth_headers):
    r = client.get("/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == "test@careerlens.ai"
