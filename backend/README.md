# Talent Desk API

This FastAPI service will own PostgreSQL access, Hugging Face inference, match calculations, and authorised recruiting-provider integrations. It is deliberately separate from the browser UI so secrets never enter the frontend bundle.

## Local setup

```sh
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Copy `.env.example` to `.env` and set the required backend-only values. Do not commit `.env`.
