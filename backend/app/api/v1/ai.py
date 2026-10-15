"""AI generation endpoints backed by Hugging Face hosted inference."""

from fastapi import APIRouter, HTTPException, status

from app.ai import AIServiceError, generate_json
from app.schemas import (
    JobDescriptionGenerateInput,
    JobDescriptionGenerateOutput,
    KeywordGenerateInput,
    KeywordGenerateOutput,
)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/job-description", response_model=JobDescriptionGenerateOutput)
async def generate_job_description(payload: JobDescriptionGenerateInput) -> JobDescriptionGenerateOutput:
    try:
        result = await generate_json(
            instruction=(
                "Write a complete, inclusive job description for this role. Include a short role summary, "
                "responsibilities, required qualifications, preferred qualifications, and an equal-opportunity note. "
                'Return JSON exactly as {"description":"..."}.'
            ),
            payload=payload.model_dump(mode="json"),
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
                f"return at most {payload.limit} unique terms. Return JSON exactly as {{\"keywords\":[\"term\"]}}."
            ),
            payload={"job_title": payload.job_title, "description": payload.description},
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
