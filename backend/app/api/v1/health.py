"""Service-health endpoint."""

from fastapi import APIRouter
from sqlalchemy import text

from app.database import SessionLocal

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    with SessionLocal() as session:
        session.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
