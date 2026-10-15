"""Database records for the core Talent Desk workflow."""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    min_experience_years: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    max_experience_years: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    salary_min_lpa: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    salary_max_lpa: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    max_notice_days: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    keywords: Mapped[list["JobKeyword"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class JobKeyword(Base):
    __tablename__ = "job_keywords"
    __table_args__ = (UniqueConstraint("job_id", "term", name="uq_job_keyword_term"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    term: Mapped[str] = mapped_column(String(160), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="human")
    is_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    job: Mapped[Job] = relationship(back_populates="keywords")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    resume_text: Mapped[str] = mapped_column(Text, nullable=False)
    years_experience: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    location: Mapped[str | None] = mapped_column(String(255))
    notice_days: Mapped[int | None] = mapped_column(Integer)
    salary_lpa: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))


class CandidateMatch(Base):
    __tablename__ = "candidate_matches"
    __table_args__ = (UniqueConstraint("job_id", "candidate_id", name="uq_candidate_match_job"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    overall_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    keyword_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    evidence: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class OnboardingTask(Base):
    __tablename__ = "onboarding_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    candidate_id: Mapped[str | None] = mapped_column(ForeignKey("candidates.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    due_date: Mapped[str | None] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="todo")


class ShortlistEntry(Base):
    __tablename__ = "shortlist_entries"
    __table_args__ = (UniqueConstraint("job_id", "candidate_id", name="uq_shortlist_job_candidate"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RecruiterSettings(Base):
    """Single-workspace recruiter defaults; authentication can scope this later."""

    __tablename__ = "recruiter_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    recruiter_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    company: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    default_role: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    default_location: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    default_skills: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    min_experience_years: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))
    max_notice_days: Mapped[int | None] = mapped_column(Integer)
    max_salary_lpa: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    linkedin_profile_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
