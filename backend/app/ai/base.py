"""AI provider abstraction.

The application always works: in MOCK_AI_MODE (default) responses are
generated deterministically; when an API key is available the OpenAI- or
Gemini-compatible provider is used. API keys never reach the frontend.
"""
import abc
import json
import re
from typing import Any, Optional

import httpx


class AIProvider(abc.ABC):
    """Base class for AI providers."""

    name: str = "base"

    @abc.abstractmethod
    def complete(self, prompt: str, system: str = "", max_tokens: int = 1200) -> str:
        """Return text completion for a prompt."""

    def complete_json(
        self, prompt: str, system: str = "", max_tokens: int = 1500
    ) -> dict[str, Any]:
        """Return a parsed JSON object (with graceful fallback)."""
        raw = self.complete(prompt, system=system, max_tokens=max_tokens)
        data = _extract_json(raw)
        if data is None:
            # Count backwards from the raw text as a last resort
            return {"raw": raw}
        return data


def _extract_json(text: str) -> Optional[dict[str, Any]]:
    """Best-effort JSON extraction from an LLM response."""
    text = text.strip()
    # Strip markdown fences
    fence_re = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence_re:
        text = fence_re.group(1).strip()
    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Find first { ... } block
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    # Find first [ ... ] block
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass
    return None


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(
        self, api_key: str, base_url: str = "https://api.openai.com/v1", model: str = "gpt-4o-mini"
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def complete(self, prompt: str, system: str = "", max_tokens: int = 1200) -> str:
        try:
            resp = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.4,
                },
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        except Exception as exc:  # pragma: no cover - network path
            raise RuntimeError(f"OpenAI request failed: {exc}")


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        self.api_key = api_key
        self.model = model

    def complete(self, prompt: str, system: str = "", max_tokens: int = 1200) -> str:
        try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{self.model}:generateContent?key={self.api_key}"
            )
            resp = httpx.post(
                url,
                json={
                    "contents": [
                        {"parts": [{"text": system + "\n\n" + prompt}]}
                    ],
                    "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.4},
                },
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as exc:  # pragma: no cover - network path
            raise RuntimeError(f"Gemini request failed: {exc}")