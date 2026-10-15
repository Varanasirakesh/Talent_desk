"""FastAPI entry point for the Talent Desk backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import router as v1_router
from app.config import settings
from app.web import router as web_router

app = FastAPI(title="Talent Desk API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(v1_router, prefix="/api/v1")
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.include_router(web_router)
