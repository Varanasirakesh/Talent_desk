# Talent Desk

Talent Desk is a standalone Next.js app for reviewing job descriptions, local resume evidence, shortlists and onboarding tasks. Its home page at `/` opens the HR workspace directly. It runs separately from the AI Hub on port **3002**.

Start by creating a requisition or choosing a Job ID already created in the current browser session. Talent Desk assigns IDs such as `HR-2026-001`, then guides you through candidate sourcing, review and onboarding one step at a time. Each job keeps its own role details, candidate pool, shortlist and tasks.

The current demo opens with **Data Engineer — Analytics Platform** (`HR-DEMO-001`). Click **Find demo candidates** to fetch six fictional recruiter-style profiles through `/api/demo-candidates.json`. Job criteria are editable, and candidate cards show experience, current/expected CTC, notice period, skills and detailed career history. See [Developer handover](docs/developer-handover.md) and [Mock provider contract](docs/recruiter-demo.md).

## Run locally

Use Node.js 22.13+ or 24+. In `frontend/`:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3002/`. The development and build hooks copy the installed PDF.js worker into `public/` so browser PDF extraction works. Check the app with `npm run typecheck`, `npm test`, and `npm run build`. `npm run start` serves the static export on port 3002.

The interface uses explicit, rule-based skill matching. It starts with fictional samples; you can upload TXT, Markdown, PDF or DOCX resumes from your device. Job records, uploaded files, edits, settings, shortlist and tasks stay in browser memory and reset on refresh. Export the shortlist, onboarding tasks and settings to retain them. Image-only scans need OCR first. External LinkedIn and Naukri links open those services; this app does not retrieve their candidate records or authenticate to them.

## Your hiring details

Copy `config/hr-preferences.example.json` to `config/my-hiring-details.local.json` and edit that local file. Import it from **Your hiring settings → Import JSON** at the top of Talent Desk. The local file is ignored by Git and excluded from public assets. You can also edit and export settings in the app. See [config/README.md](config/README.md) for fields and handling notes.

## Deploy independently

Run `npm run build` and publish `out/` as a standalone static site. The app needs no server for the current local workflow. Protect access to the deployed site and review your data handling requirements before using real resumes. This version has no account login, shared database, automatic persistence or live recruiting-provider integration.
