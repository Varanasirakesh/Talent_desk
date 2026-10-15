"""Hugging Face hosted-inference helpers for Talent Desk AI features."""

import json
from typing import Any

import httpx

from app.config import settings


class AIServiceError(Exception):
    """A safe error that can be returned to an API caller."""


def _json_content(content: str) -> dict[str, Any]:
    """Accept a JSON object, including the common fenced-code response form."""
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0].strip()
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("The AI response was not a JSON object.")
    return value


async def generate_json(*, instruction: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not settings.hugging_face_token:
        raise AIServiceError("HUGGING_FACE_TOKEN is not configured on the server.")

    request = {
        "model": settings.hugging_face_model,
        "messages": [
            {
                "role": "system",
                "content": "You are an HR recruiting assistant. Return only valid JSON; no markdown or explanation.",
            },
            {"role": "user", "content": f"{instruction}\n\nInput:\n{json.dumps(payload)}"},
        ],
        "temperature": 0.2,
        "max_tokens": 1400,
        "response_format": {"type": "json_object"},
    }
    headers = {"Authorization": f"Bearer {settings.hugging_face_token}"}
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(settings.hugging_face_api_url, headers=headers, json=request)
            response.raise_for_status()
        body = response.json()
        content = body["choices"][0]["message"]["content"]
        return _json_content(content)
    except httpx.TimeoutException as error:
        raise AIServiceError("The Hugging Face request timed out. Please try again.") from error
    except httpx.HTTPStatusError as error:
        detail = error.response.text[:300]
        raise AIServiceError(f"Hugging Face inference failed ({error.response.status_code}): {detail}") from error
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise AIServiceError("Hugging Face returned an invalid AI response. Please try again.") from error
