"""Application configuration loaded from environment variables.

The application works out of the box with no API keys: when
AI_PROVIDER == "mock" or no provider key is configured, the backend
automatically falls back to a deterministic MOCK_AI_MODE.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

# Placeholder values that must NEVER be accepted as SECRET_KEY in production.
# (Built-in default, the dev docker-compose value, and the .env.example stub.)
_PRODUCTION_FORBIDDEN_SECRETS = frozenset({
    "dev-secret-change-me-in-production",
    "change-me-in-production",
    "change-me-to-a-long-random-secret-string",
})

_ALLOWED_ENVIRONMENTS = frozenset({"development", "staging", "production"})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # App
    APP_NAME: str = "CareerLens AI"
    # development | staging | production — production is validated strictly
    # below and refuses to boot with unsafe defaults (see model_validator).
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "dev-secret-change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Database — SQLite by default so the app runs with zero setup.
    # Set DATABASE_URL to a PostgreSQL URL to use PostgreSQL.
    DATABASE_URL: str = "sqlite:///./careerlens.db"
    # AI provider: mock | openai | gemini
    AI_PROVIDER: str = "mock"
    MOCK_AI_MODE: bool = True

    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # Seeding
    SEED_DEMO_DATA: bool = True

    # Uploads (relative to backend/)
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 5
    ALLOWED_UPLOAD_EXTENSIONS: str = ".pdf,.docx,.txt"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def resolved_database_url(self) -> str:
        """A CWD-independent database URL.

        The default ``sqlite:///./careerlens.db`` is relative to the process
        working directory, which caused the backend (run from ``backend/``) and
        helper scripts (run from the repo root) to open *different* database
        files. For the default SQLite URL we anchor the file under ``backend/``
        so the path is stable no matter where the process starts. Explicit
        ``DATABASE_URL`` values (including PostgreSQL) are returned unchanged.
        """
        url = self.DATABASE_URL
        if url == "sqlite:///./careerlens.db":
            return f"sqlite:///{(BACKEND_DIR / 'careerlens.db').as_posix()}"
        return url

    @property
    def upload_dir(self) -> Path:
        p = BACKEND_DIR / self.UPLOAD_DIR
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def allowed_extensions(self) -> set[str]:
        return {e.strip().lower() for e in self.ALLOWED_UPLOAD_EXTENSIONS.split(",")}

    @property
    def docs_enabled(self) -> bool:
        """Interactive API docs (/docs, /redoc, /openapi.json) follow DEBUG.

        Production (validated below) forces DEBUG=false, so the full API
        surface is never exposed publicly unless DEBUG is deliberately on.
        """
        return bool(self.DEBUG)

    @model_validator(mode="after")
    def _validate_production_settings(self) -> "Settings":
        """Fail fast on unsafe configuration instead of booting silently.

        In production the app refuses to start when:
        - SECRET_KEY is a default/placeholder or shorter than 32 chars
          (would allow JWT forgery with a publicly known key), or
        - DEBUG is true (would expose /docs, /redoc, /openapi.json), or
        - CORS_ORIGINS still points at localhost (every browser API call
          from the real frontend would be blocked anyway).

        Development/staging keep zero-setup defaults so nothing breaks.
        """
        env = (self.ENVIRONMENT or "").strip().lower()
        if env not in _ALLOWED_ENVIRONMENTS:
            raise ValueError(
                f"ENVIRONMENT must be one of {sorted(_ALLOWED_ENVIRONMENTS)}, "
                f"got {self.ENVIRONMENT!r}"
            )
        self.ENVIRONMENT = env
        if env != "production":
            return self

        problems: list[str] = []
        if (
            self.SECRET_KEY in _PRODUCTION_FORBIDDEN_SECRETS
            or len(self.SECRET_KEY) < 32
        ):
            problems.append(
                "SECRET_KEY must be a unique value of at least 32 characters "
                '(generate: python -c "import secrets; print(secrets.token_hex(32))")'
            )
        if self.DEBUG:
            problems.append(
                "DEBUG must be false in production (it exposes API docs endpoints)"
            )
        origins = self.CORS_ORIGINS or ""
        if "localhost" in origins or "127.0.0.1" in origins:
            problems.append(
                "CORS_ORIGINS must list the real frontend origin(s), "
                "e.g. https://app.example.com"
            )
        if problems:
            raise ValueError(
                "Invalid production configuration: " + "; ".join(problems)
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
