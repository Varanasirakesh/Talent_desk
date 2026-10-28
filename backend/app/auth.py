"""Password hashing and bootstrap account helpers."""

import base64
import hashlib
import hmac
import os

from sqlalchemy import select

from app.database import SessionLocal
from app.models import User

ITERATIONS = 390_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt, digest = stored.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(iterations))
        return hmac.compare_digest(actual, base64.b64decode(digest))
    except (ValueError, TypeError):
        return False


def ensure_default_user() -> None:
    session = SessionLocal()
    try:
        if not session.scalar(select(User).where(User.username == "recruiter")):
            session.add(User(username="recruiter", password_hash=hash_password("hiretalent")))
            session.commit()
    finally:
        session.close()
