# Talent Desk

Talent Desk is organised as a frontend/backend application.

- `frontend/` contains the Next.js recruiter workspace.
- `backend/` contains the FastAPI service for PostgreSQL, Hugging Face inference, matching, and future authorised provider integrations.

## Run locally

Start the UI from `frontend/`:

```sh
npm ci
npm run dev
```

The FastAPI service is scaffolded in `backend/`. Copy `backend/.env.example` to `backend/.env` and supply backend-only credentials before implementing integrations.
