"""Deployment-security regression tests.

Covers the audit fixes:
- production configuration fail-fast (SECRET_KEY, DEBUG, CORS origins) — the
  same validation guards JWT signing, since tokens use SECRET_KEY;
- API docs gating (/docs, /redoc, /openapi.json follow DEBUG);
- upload filename sanitisation (path-traversal defence).
"""
import asyncio
import io
import re

import pytest
from fastapi import HTTPException, UploadFile
from pydantic import ValidationError

from app.api.resumes import safe_upload_name
from app.core.config import Settings
from app.main import app as fastapi_app
from app.services.resume_parser import extract_resume_text


def _prod(**overrides) -> Settings:
    """A production Settings instance with safe baseline values."""
    kwargs = dict(
        ENVIRONMENT="production",
        SECRET_KEY="f" * 64,               # unique, >= 32 chars
        DEBUG=False,
        CORS_ORIGINS="https://app.example.com",
    )
    kwargs.update(overrides)
    return Settings(_env_file=None, **kwargs)


# ---------------------------------------------------------------------------
# Production configuration fail-fast
# ---------------------------------------------------------------------------


def test_production_rejects_builtin_default_secret():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        _prod(SECRET_KEY="dev-secret-change-me-in-production")


def test_production_rejects_env_example_placeholder_secret():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        _prod(SECRET_KEY="change-me-to-a-long-random-secret-string")


def test_production_rejects_dev_compose_placeholder_secret():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        _prod(SECRET_KEY="change-me-in-production")


def test_production_rejects_short_secret():
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        _prod(SECRET_KEY="short-secret")


def test_production_rejects_debug_true():
    with pytest.raises(ValidationError, match="DEBUG"):
        _prod(DEBUG=True)


def test_production_rejects_localhost_cors():
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        _prod(CORS_ORIGINS="http://localhost:5173,http://localhost:3000")


def test_production_accepts_safe_configuration():
    s = _prod()
    assert s.ENVIRONMENT == "production"
    assert s.SECRET_KEY == "f" * 64


def test_environment_name_is_normalised():
    assert _prod(ENVIRONMENT="Production").ENVIRONMENT == "production"


def test_unknown_environment_is_rejected():
    with pytest.raises(ValidationError, match="ENVIRONMENT"):
        Settings(_env_file=None, ENVIRONMENT="prodction")


def test_development_keeps_zero_setup_defaults():
    """Dev/staging must not require any env vars (existing workflow intact)."""
    for env in ("development", "staging"):
        s = Settings(_env_file=None, ENVIRONMENT=env)
        assert s.DEBUG is True
        assert s.SECRET_KEY  # default allowed outside production


# ---------------------------------------------------------------------------
# API docs gating (docs follow DEBUG; production forces DEBUG=false)
# ---------------------------------------------------------------------------


def test_docs_enabled_follows_debug():
    assert Settings(_env_file=None, DEBUG=False).docs_enabled is False
    assert Settings(_env_file=None, DEBUG=True).docs_enabled is True


def test_app_exposes_docs_in_development():
    # Tests run with development settings, so docs stay available locally.
    assert fastapi_app.docs_url == "/docs"
    assert fastapi_app.openapi_url == "/openapi.json"


# ---------------------------------------------------------------------------
# Upload filename sanitisation (path-traversal defence)
# ---------------------------------------------------------------------------

_SAFE_NAME = re.compile(r"user\d+_[0-9a-f]{32}_[A-Za-z0-9._-]{1,60}")


@pytest.mark.parametrize("evil", [
    "../../../../etc/passwd",
    "..\\..\\..\\evil.txt",
    "....//....//evil.txt",
    "/absolute/path/evil.txt",
    "resume\x00.txt",
    "évil resume – ünïcode.txt",
    ".",
    "..",
    "...",
    "",
])
def test_safe_upload_name_is_always_a_flat_whitelisted_component(evil):
    name = safe_upload_name(7, evil)
    assert name.startswith("user7_")
    assert "/" not in name and "\\" not in name and "\x00" not in name
    assert ".." not in name.replace("user7_", "")          # no traversal segments
    assert _SAFE_NAME.fullmatch(name), name


def test_safe_upload_name_truncates_long_names():
    name = safe_upload_name(1, "a" * 500 + ".txt")
    tail = name.split("_", 2)[2]
    assert len(tail) <= 60


def test_safe_upload_name_is_unique_per_upload():
    a = safe_upload_name(1, "cv.txt")
    b = safe_upload_name(1, "cv.txt")
    assert a != b  # uuid component


def test_parser_rejects_destination_outside_upload_dir(tmp_path):
    """Defense-in-depth: even a bad `dest` from a caller must not be written."""
    upload = UploadFile(file=io.BytesIO(b"hello"), filename="ok.txt")

    async def run():
        return await extract_resume_text(upload, tmp_path / "escaped.txt")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(run())
    assert exc.value.status_code == 400
    assert not (tmp_path / "escaped.txt").exists()


def test_upload_with_traversal_filename_stays_in_upload_dir(
        client, demo_headers, monkeypatch, tmp_path):
    """End-to-end: a malicious multipart filename lands only inside the
    uploads directory, as a sanitised single path component."""
    from app.core.config import settings as app_settings

    upload_root = tmp_path / "uploads"
    monkeypatch.setattr(app_settings, "UPLOAD_DIR", str(upload_root))

    evil = "../../../../evil.txt"
    r = client.post(
        "/resumes/upload",
        headers=demo_headers,
        files={"file": (evil, b"traversal attempt", "text/plain")},
    )
    assert r.status_code == 201, r.text

    stored = list(upload_root.iterdir())
    assert len(stored) == 1                      # exactly one file, in the root
    assert stored[0].parent == upload_root.resolve()
    assert _SAFE_NAME.fullmatch(stored[0].name), stored[0].name
    assert stored[0].read_bytes() == b"traversal attempt"
    # The raw name is preserved for display only — never used as a path.
    assert r.json()["original_filename"] == evil