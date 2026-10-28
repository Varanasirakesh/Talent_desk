"""FastAPI entry point for the Talent Desk backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse
from app.auth import ensure_default_user
from app.database import Base, engine
from app import models  # noqa: F401 - registers model metadata
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


@app.on_event("startup")
def create_auth_table() -> None:
    Base.metadata.create_all(engine)
    ensure_default_user()


@app.middleware("http")
async def require_login(request, call_next):
    public_paths = ("/login", "/register", "/static/", "/health", "/docs", "/openapi.json", "/api/")
    if request.url.path.startswith(public_paths) or request.session.get("user_id"):
        return await call_next(request)
    return RedirectResponse(url="/login", status_code=303)


app.add_middleware(SessionMiddleware, secret_key=settings.session_secret, same_site="lax", https_only=False)
