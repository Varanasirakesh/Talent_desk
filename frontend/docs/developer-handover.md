# Talent Desk developer handover

## Start here

Open the repository's `frontend` folder. Install Node.js 22.13+ or 24+, then run:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3002/. No API keys or external account are needed. Click **Find demo candidates** on the initial Data Engineer requisition, open a profile, shortlist it and continue to onboarding.

## Verify and build

```sh
npm run typecheck
npm test
npm run build
npm run start
```

The build produces `out/` for static hosting. The predev/prebuild hooks copy the PDF worker from installed dependencies into `public/`; it is intentionally omitted from this source ZIP.

Leave `NEXT_PUBLIC_HR_BASE_PATH` unset for standalone development and deployment. To embed the app under `/apps/hr`, set it to `/apps/hr` **before building**, and serve the resulting export under that path. The mock provider uses the same prefix for its API requests.

## Code map

- `src/features/hr/workspace.tsx`: requisitions, editable criteria, four-step workflow, candidate cards/dialogs, shortlist and onboarding.
- `src/features/hr/model.ts`: skill extraction, evidence coverage, filters and CSV export.
- `src/features/hr/portal.ts`: candidate-provider interface, HTTP fetch and response validation/adapter.
- `src/features/hr/portal-fixture.ts`: versioned fictional response and initial Data Engineer requirement.
- `src/app/api/demo-candidates.json/route.ts`: static mock GET endpoint; no server-side search yet.
- `src/features/hr/imports.ts`: local TXT/MD/PDF/DOCX resume extraction and duplicate fingerprints.
- `src/features/hr/preferences.ts` and `settings.tsx`: settings validation, editing, import/export.
- `src/styles/`: application, hiring and portal-card styling.
- `tests/`: matching, provider, workflow and settings regression tests.

## State and provider boundaries

All job and candidate data stays in browser-session memory and resets on refresh. CSV/JSON exports retain selected data. There is no database, authentication, LLM or live Naukri connection. The demo response imitates recruiter-style information and is not a verified Naukri contract.

The provider returns all six mock profiles, then the app filters/sorts them locally. Salary and notice can be unknown; do not turn missing values into zero. Skill coverage means explicit resume mentions, not a hiring recommendation. Experience, budget and notice checks use separate editable job criteria.

For a future integration, replace `demoCandidateProvider` at the workspace import boundary with a provider implementing `CandidateProvider`. Map the authorised provider's documented response into `Candidate`; keep provider credentials and real API calls server-side. Extend the source labels/validation for real data before connecting it.

## Package contents

This ZIP contains source, tests, package lockfile, scripts, configuration templates and documentation. It excludes `node_modules`, `.next`, `out`, Git history, environment secrets, personal `*.local.json` settings and generated build caches. Install dependencies with `npm ci` rather than copying them from another machine.
