# Talent Desk API

This FastAPI service serves the Talent Desk UI as well as the versioned API. It uses
MySQL for persisted requisitions, candidates, matching, shortlists, and onboarding.
HTMX and Alpine are loaded by the server-rendered templates; no browser secret is used.

## Local setup

```sh
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m app.create_tables
uvicorn app.main:app --reload --port 8000
```

Set the MySQL `DATABASE_URL` in `.env`; never commit that file. Visit `/` for the UI,
`/health` for a database health check, and `/docs` for the API documentation.
