"""Persistent requisition and approved-keyword endpoints."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_session
from app.models import Job, JobKeyword
from app.schemas import (
    JobInput,
    JobOutput,
    KeywordApprovalUpdate,
    KeywordInput,
    KeywordOutput,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def with_keywords(statement):
    return statement.options(selectinload(Job.keywords))


def normalised_keywords(keywords: list[KeywordInput]) -> list[KeywordInput]:
    unique: dict[str, KeywordInput] = {}
    for keyword in keywords:
        term = keyword.term.strip()
        if term:
            unique.setdefault(term.casefold(), keyword.model_copy(update={"term": term}))
    return list(unique.values())


def job_response(job: Job) -> JobOutput:
    return JobOutput.model_validate(job)


@router.get("", response_model=list[JobOutput])
def list_jobs(session: Session = Depends(get_session)) -> list[JobOutput]:
    jobs = session.scalars(with_keywords(select(Job).order_by(Job.created_at.desc()))).all()
    return [job_response(job) for job in jobs]


@router.post("", response_model=JobOutput, status_code=status.HTTP_201_CREATED)
def create_job(payload: JobInput, session: Session = Depends(get_session)) -> JobOutput:
    year = datetime.now(UTC).year
    count = session.scalar(select(func.count()).select_from(Job).where(Job.id.like(f"HR-{year}-%"))) or 0
    job = Job(id=f"HR-{year}-{count + 1:03d}", **payload.model_dump(exclude={"keywords"}))
    job.keywords = [JobKeyword(**keyword.model_dump()) for keyword in normalised_keywords(payload.keywords)]
    session.add(job)
    session.commit()
    return job_response(session.scalar(with_keywords(select(Job).where(Job.id == job.id))))


@router.put("/{job_id}", response_model=JobOutput)
def update_job(job_id: str, payload: JobInput, session: Session = Depends(get_session)) -> JobOutput:
    job = session.scalar(with_keywords(select(Job).where(Job.id == job_id)))
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    for field, value in payload.model_dump(exclude={"keywords"}).items():
        setattr(job, field, value)
    job.keywords = [JobKeyword(**keyword.model_dump()) for keyword in normalised_keywords(payload.keywords)]
    session.commit()
    return job_response(session.scalar(with_keywords(select(Job).where(Job.id == job_id))))


@router.put("/{job_id}/keywords", response_model=list[KeywordOutput])
def replace_keywords(job_id: str, payload: list[KeywordInput], session: Session = Depends(get_session)) -> list[KeywordOutput]:
    job = session.scalar(with_keywords(select(Job).where(Job.id == job_id)))
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.keywords = [JobKeyword(**keyword.model_dump()) for keyword in normalised_keywords(payload)]
    session.commit()
    return [KeywordOutput.model_validate(keyword) for keyword in job.keywords]


@router.patch("/{job_id}/keywords/{keyword_id}", response_model=KeywordOutput)
def update_keyword_approval(
    job_id: str,
    keyword_id: int,
    payload: KeywordApprovalUpdate,
    session: Session = Depends(get_session),
) -> KeywordOutput:
    keyword = session.scalar(
        select(JobKeyword).where(
            JobKeyword.id == keyword_id,
            JobKeyword.job_id == job_id,
        ),
    )
    if keyword is None:
        raise HTTPException(status_code=404, detail="Keyword not found for this job.")
    keyword.is_approved = payload.is_approved
    session.commit()
    session.refresh(keyword)
    return KeywordOutput.model_validate(keyword)
