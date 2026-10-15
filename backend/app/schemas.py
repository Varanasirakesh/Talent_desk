"""Request and response contracts for persisted requisitions."""

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class KeywordInput(BaseModel):
    term: str = Field(min_length=1, max_length=160)
    source: str = Field(default="human", pattern="^(human|ai)$")


class JobInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    description: str = Field(min_length=1)
    min_experience_years: Decimal | None = Field(default=None, ge=0, le=80)
    max_experience_years: Decimal | None = Field(default=None, ge=0, le=80)
    salary_min_lpa: Decimal | None = Field(default=None, ge=0, le=10000)
    salary_max_lpa: Decimal | None = Field(default=None, ge=0, le=10000)
    max_notice_days: int | None = Field(default=None, ge=0, le=730)
    keywords: list[KeywordInput] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def validate_ranges(self) -> "JobInput":
        if (
            self.min_experience_years is not None
            and self.max_experience_years is not None
            and self.min_experience_years > self.max_experience_years
        ):
            raise ValueError("Minimum experience cannot exceed maximum experience.")
        if (
            self.salary_min_lpa is not None
            and self.salary_max_lpa is not None
            and self.salary_min_lpa > self.salary_max_lpa
        ):
            raise ValueError("Minimum budget cannot exceed maximum budget.")
        return self


class KeywordOutput(KeywordInput):
    id: int
    is_approved: bool

    model_config = ConfigDict(from_attributes=True)


class KeywordApprovalUpdate(BaseModel):
    is_approved: bool


class JobOutput(JobInput):
    id: str
    keywords: list[KeywordOutput]

    model_config = ConfigDict(from_attributes=True)


class JobDescriptionGenerateInput(BaseModel):
    role_title: str = Field(min_length=2, max_length=255)
    location: str | None = Field(default=None, max_length=255)
    min_experience_years: Decimal | None = Field(default=None, ge=0, le=80)
    max_experience_years: Decimal | None = Field(default=None, ge=0, le=80)
    additional_requirements: str | None = Field(default=None, max_length=5000)


class JobDescriptionGenerateOutput(BaseModel):
    description: str


class KeywordGenerateInput(BaseModel):
    job_title: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=20, max_length=20000)
    limit: int = Field(default=20, ge=1, le=40)


class KeywordGenerateOutput(BaseModel):
    keywords: list[str]
