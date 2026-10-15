"""Create the initial local MySQL tables.

Replace this bootstrap command with Alembic migrations before production deployment.
"""

from app.database import Base, engine
from app import models  # noqa: F401 - registers model metadata


def main() -> None:
    Base.metadata.create_all(engine)
    print("Talent Desk MySQL tables are ready.")


if __name__ == "__main__":
    main()
