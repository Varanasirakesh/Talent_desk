# Talent Desk

Talent Desk is a FastAPI application with a server-rendered recruiter workspace.
HTMX handles server interactions and Alpine handles small UI state. MySQL stores
requisitions, keywords, candidates, match records, shortlists, and onboarding tasks.
The current transparent score weights approved keyword coverage at 70% and relevant
job-description text coverage at 30%; it is a review aid, not an automated hiring decision.

## Run locally

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Set DATABASE_URL in .env
python -m app.create_tables
uvicorn app.main:app --reload --port 8000
```

Open `http://127.0.0.1:8000/` for the recruiter workspace and
`http://127.0.0.1:8000/docs` for the versioned API.
