"""AI provider factory.

Selects OpenAI / Gemini / Mock provider based on settings:
  - AI_PROVIDER=mock (default)        -> deterministic MockAIProvider
  - AI_PROVIDER=openai with key       -> OpenAI-compatible provider
  - AI_PROVIDER=gemini with key       -> Gemini provider
Always falls back to mock when a key is missing so the app never breaks.
"""
from app.ai.base import AIProvider, GeminiProvider, OpenAIProvider
from app.ai.mock import MockAIProvider
from app.core.config import settings

_active_provider: AIProvider | None = None


def get_ai_provider() -> AIProvider:
    global _active_provider
    if _active_provider is not None:
        return _active_provider

    provider_name = settings.AI_PROVIDER.strip().lower()
    if provider_name == "openai" and settings.OPENAI_API_KEY:
        _active_provider = OpenAIProvider(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL,
            model=settings.OPENAI_MODEL,
        )
    elif provider_name == "gemini" and settings.GEMINI_API_KEY:
        _active_provider = GeminiProvider(
            api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL
        )
    elif provider_name in ("openai", "gemini") and settings.MOCK_AI_MODE:
        # Key missing but user asked for a real provider => safe fallback.
        _active_provider = MockAIProvider()
    else:
        _active_provider = MockAIProvider()
    return _active_provider


def reset_provider_for_tests() -> None:
    global _active_provider
    _active_provider = None


def is_mock_mode() -> bool:
    if settings.AI_PROVIDER.strip().lower() in ("openai", "gemini"):
        key = (
            settings.OPENAI_API_KEY
            if settings.AI_PROVIDER.strip().lower() == "openai"
            else settings.GEMINI_API_KEY
        )
        return not bool(key) or settings.MOCK_AI_MODE
    return settings.MOCK_AI_MODE