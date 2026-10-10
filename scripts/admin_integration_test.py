"""Phase B admin integration check (live server).

Runs against a running backend at http://localhost:8000 and verifies the
end-to-end admin workflow without touching the real admin account:

  1. Bootstrap a throwaway admin programmatically (bootstrap_admin), so no
     interactive password prompt and no real credentials are used.
  2. Log in as that admin and confirm every /admin/* endpoint returns 200.
  3. Confirm the dashboard stats are genuinely backend-backed (numbers present).
  4. Register a student and confirm they are blocked (403) from every admin API.
  5. Confirm public registration can never create an admin.
  6. Delete the throwaway admin/student so the dev DB is left clean.

Prints "ADMIN INTEGRATION OK" on success.
"""
import json
import secrets
import urllib.error
import urllib.request

BASE = "http://localhost:8000"
SUFFIX = secrets.token_hex(4)
ADMIN_EMAIL = f"itest-admin-{SUFFIX}@example.com"
ADMIN_PASSWORD = f"Itest{SUFFIX}A!x9"
ADMIN_NAME = "Integration Admin"
STUDENT_EMAIL = f"itest-student-{SUFFIX}@example.com"
STUDENT_PASSWORD = f"Itest{SUFFIX}S!x9"


def _req(method: str, path: str, token: str | None = None, body: dict | None = None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def bootstrap_admin() -> int:
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
    from app.cli.create_admin import bootstrap_admin as _bs
    from app.database.db import SessionLocal, init_db

    init_db()
    db = SessionLocal()
    try:
        code, msg = _bs(db, email=ADMIN_EMAIL, full_name=ADMIN_NAME, password=ADMIN_PASSWORD)
        print(f"bootstrap: {msg}")
        assert code == 0, msg
    finally:
        db.close()
    return 0


def main() -> int:
    bootstrap_admin()

    # 2. Admin login.
    status, login = _req("POST", "/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert status == 200, f"admin login failed: {status} {login}"
    admin_token = login["access_token"]
    assert login["user"]["role"] == "admin"
    print("OK  admin login (role=admin)")

    # 3. Every admin endpoint returns 200 and is backend-backed.
    for path in ["/admin/stats", "/admin/users", "/admin/settings", "/admin/careers", "/admin/jobs"]:
        s, body = _req("GET", path, token=admin_token)
        assert s == 200, f"{path} -> {s}"
        print(f"OK  {path} (200)")

    # Stats genuinely contain backend numbers.
    s, stats = _req("GET", "/admin/stats", token=admin_token)
    assert stats["users"]["total"] >= 1 and stats["users"]["admins"] >= 1
    assert "career_paths" in stats["content"]
    print(f"OK  dashboard stats backend-backed (users={stats['users']['total']}, "
          f"careers={stats['content']['career_paths']})")

    # 4. Register a student; confirm student is blocked from admin APIs.
    s, reg = _req("POST", "/auth/register", body={
        "full_name": "Integration Student", "email": STUDENT_EMAIL, "password": STUDENT_PASSWORD,
    })
    assert s == 201, f"student register failed: {s} {reg}"
    student_token = reg["access_token"]
    student_id = reg["user"]["id"]
    assert reg["user"]["role"] == "student", "registration must not set role"
    print("OK  public registration created a student (role=student)")

    for path in ["/admin/stats", "/admin/users", "/admin/settings", "/admin/careers", "/admin/jobs"]:
        s, _ = _req("GET", path, token=student_token)
        assert s == 403, f"student got {s} on {path} (expected 403)"
    print("OK  student blocked (403) from every admin API")

    # Student cannot self-promote via PATCH either.
    s, _ = _req("PATCH", f"/admin/users/{student_id}", token=student_token, body={"role": "admin"})
    assert s == 403, f"student self-promote not blocked: {s}"
    print("OK  student cannot self-promote (403)")

    # No auth -> 401.
    s, _ = _req("GET", "/admin/stats")
    assert s == 401
    print("OK  missing auth -> 401")

    # 5. Cleanup: remove throwaway admin + student so the dev DB stays clean.
    _, me = _req("GET", "/auth/me", token=admin_token)
    admin_id = me["id"]
    _req("DELETE", f"/admin/users/{student_id}", token=admin_token)  # if supported; ignore result
    _req("PATCH", f"/admin/users/{student_id}", token=admin_token, body={"is_active": False})
    # Best-effort hard delete of both test rows directly (test cleanup only).
    from app.database.db import SessionLocal
    from app.models.user import User
    db = SessionLocal()
    try:
        db.query(User).filter(User.id.in_([admin_id, student_id])).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()
    print("OK  cleaned up test admin + student")

    print("\nADMIN INTEGRATION OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
