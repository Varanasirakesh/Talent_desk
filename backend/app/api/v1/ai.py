"""Hugging Face client and AI generation endpoints."""

import json
import logging
from time import perf_counter
from typing import Any

import httpx

from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.schemas import (
    JobDescriptionGenerateInput,
    JobDescriptionGenerateOutput,
    KeywordGenerateInput,
    KeywordGenerateOutput,
)

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger("uvicorn.error")


class AIServiceError(Exception):
    """A safe error that can be returned to an API caller."""


JOB_DESCRIPTION_INSTRUCTION = """Create a polished, recruiter-ready plain-text job description.

Every supplied input is a binding HR requirement. Do not omit, weaken, change, or contradict it. Use additional_requirements as mandatory context. Do not invent company facts, education requirements, compensation, location, experience, or notice-period requirements that were not supplied.

Use this exact structure when the information is available:

Use clean section headings exactly like `JOB DESCRIPTION`, `RESPONSIBILITIES`, and `REQUIREMENTS`. Do not use Markdown symbols such as #, *, _, or links.

JOB DESCRIPTION
Write two short, professional paragraphs explaining the role, team context, and why the role matters.

RESPONSIBILITIES
- Start every item with an action verb.
- Provide 5 to 8 specific responsibilities.

REQUIREMENTS
- Provide 5 to 8 essential technical, domain, and experience requirements.

PREFERRED QUALIFICATIONS
- Provide 2 to 4 optional qualifications. Omit this section if none are reasonable.

ROLE DETAILS
- Role: <role title>
- Location: <location, if provided>
- Employment Type: Full Time, Permanent
- Experience: <range, if provided>
- Compensation: <budget range, only if provided>
- Notice Period: <days, only if provided>

EDUCATION
Include education only when supplied in the input or additional requirements.

KEY SKILLS
Provide a comma-separated list of 8 to 15 candidate-search skills and tools.

Follow the style of a clear Naukri-ready job post: concise paragraphs, plain-text headings, and hyphen bullet lists.
Do not include links, discriminatory requirements, unsupported claims, or invented company/team details.
Return JSON exactly as {"description":"..."}."""

JOB_DESCRIPTION_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {"description": {"type": "string"}},
    "required": ["description"],
    "additionalProperties": False,
}

KEYWORD_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {"keywords": {"type": "array", "items": {"type": "string"}}},
    "required": ["keywords"],
    "additionalProperties": False,
}


def _json_content(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        text = text.rsplit("```", 1)[0].strip()
    value = json.loads(text)
    if not isinstance(value, dict):
        raise ValueError("The AI response was not a JSON object.")
    return value


async def generate_json(*, instruction: str, payload: dict[str, Any], response_schema: dict[str, Any] | None = None, operation: str = "AI generation") -> dict[str, Any]:
    started_at = perf_counter()
    provider = settings.ai_provider.casefold()
    model = settings.ollama_model if provider == "ollama" else settings.hugging_face_model
    logger.info("AI started: operation=%s provider=%s model=%s", operation, provider, model)
    messages = [
        {"role": "system", "content": "You are an HR recruiting assistant. Return only valid JSON; no markdown or explanation."},
        {"role": "user", "content": f"{instruction}\n\nInput:\n{json.dumps(payload)}"},
    ]
    try:
        if provider == "ollama":
            request = {"model": settings.ollama_model, "messages": messages, "stream": False, "format": response_schema or "json", "options": {"temperature": 0.2, "num_predict": 900}}
            async with httpx.AsyncClient(timeout=180) as client:
                response = await client.post(settings.ollama_api_url, json=request)
            response.raise_for_status()
            result = _json_content(response.json()["message"]["content"])
            logger.info("AI completed: operation=%s duration=%.1fs", operation, perf_counter() - started_at)
            return result

        if provider != "huggingface":
            raise AIServiceError("AI_PROVIDER must be either 'huggingface' or 'ollama'.")
        if not settings.hugging_face_token:
            raise AIServiceError("HUGGING_FACE_TOKEN is not configured on the server.")
        request = {"model": settings.hugging_face_model, "messages": messages, "temperature": 0.2, "max_tokens": 1400}
        headers = {"Authorization": f"Bearer {settings.hugging_face_token}"}
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(settings.hugging_face_api_url, headers=headers, json=request)
        response.raise_for_status()
        result = _json_content(response.json()["choices"][0]["message"]["content"])
        logger.info("AI completed: operation=%s duration=%.1fs", operation, perf_counter() - started_at)
        return result
    except httpx.TimeoutException as error:
        logger.warning("AI timed out: operation=%s duration=%.1fs", operation, perf_counter() - started_at)
        raise AIServiceError("The Hugging Face request timed out. Please try again.") from error
    except httpx.HTTPStatusError as error:
        logger.warning("AI request failed: operation=%s status=%s duration=%.1fs", operation, error.response.status_code, perf_counter() - started_at)
        detail = error.response.text[:300]
        raise AIServiceError(f"Hugging Face inference failed ({error.response.status_code}): {detail}") from error
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        logger.warning("AI response was invalid: operation=%s duration=%.1fs", operation, perf_counter() - started_at)
        raise AIServiceError("Hugging Face returned an invalid AI response. Please try again.") from error


@router.post("/job-description", response_model=JobDescriptionGenerateOutput)
async def generate_job_description(payload: JobDescriptionGenerateInput) -> JobDescriptionGenerateOutput:
    try:
        result = await generate_json(
            instruction=JOB_DESCRIPTION_INSTRUCTION,
            payload=payload.model_dump(mode="json"),
            response_schema=JOB_DESCRIPTION_RESPONSE_SCHEMA,
            operation="job description API",
        )
        description = str(result.get("description", "")).strip()
        if len(description) < 50:
            raise ValueError("Generated description is too short.")
        return JobDescriptionGenerateOutput(description=description)
    except (AIServiceError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error


@router.post("/keywords", response_model=KeywordGenerateOutput)
async def generate_keywords(payload: KeywordGenerateInput) -> KeywordGenerateOutput:
    try:
        result = await generate_json(
            instruction=(
                "Extract only specific candidate-search keywords from the job title and description: skills, tools, "
                "frameworks, certifications, domain terms, and seniority phrases. Exclude generic soft skills and "
                "generic words such as experience, requirements, skills, team, role, or the job title itself. "
                f"return at most {payload.limit} unique terms. Return JSON exactly as {{\"keywords\":[\"term\"]}}."
            ),
            payload={"job_title": payload.job_title, "description": payload.description},
            response_schema=KEYWORD_RESPONSE_SCHEMA,
            operation="keyword API",
        )
        raw_keywords = result.get("keywords", [])
        if not isinstance(raw_keywords, list):
            raise ValueError("AI keywords response is invalid.")
        unique: dict[str, str] = {}
        for value in raw_keywords:
            term = str(value).strip()[:160]
            if term:
                unique.setdefault(term.casefold(), term)
        return KeywordGenerateOutput(keywords=list(unique.values())[: payload.limit])
    except (AIServiceError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(error)) from error
