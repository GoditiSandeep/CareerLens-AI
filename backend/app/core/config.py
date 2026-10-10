"""Application configuration loaded from environment variables.

The application works out of the box with no API keys: when
AI_PROVIDER == "mock" or no provider key is configured, the backend
automatically falls back to a deterministic MOCK_AI_MODE.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # App
    APP_NAME: str = "CareerLens AI"
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
    def upload_dir(self) -> Path:
        p = BACKEND_DIR / self.UPLOAD_DIR
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def allowed_extensions(self) -> set[str]:
        return {e.strip().lower() for e in self.ALLOWED_UPLOAD_EXTENSIONS.split(",")}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
