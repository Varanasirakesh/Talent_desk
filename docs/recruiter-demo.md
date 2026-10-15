# Recruiter portal demo

Talent Desk starts with a Data Engineer — Analytics Platform requisition: 3–5 years, ₹12–20 LPA, Hyderabad/hybrid, full-time and a target notice period of 45 days. The salary is a fictional demo budget, not a market benchmark.

Click **Find demo candidates** from the role, or **Fetch demo profiles** in Add candidates. The browser fetches `/api/demo-candidates.json` (prefixed by the app base path when embedded in the Hub). Six fictional records are validated and adapted to the internal Candidate model, then reviewed using the existing skill coverage, filters, shortlist, export and onboarding flow. Repeating a search does not duplicate profiles. Failures display an error; no fallback silently substitutes candidate data.

## Contract

`schemaVersion`, `provider`, `isMock`, `requestId`, `total`, and `profiles` wrap the response. Each profile includes a stable ID, name, headline, current employment, experience, location/preferences, INR/LPA compensation, notice, skills, career history, education, update date and resume text. Unknown salary and notice values remain null. All names, companies, work history and amounts are fictional.

This is our Naukri-style demo contract, not a verified Naukri API response. It has no live connection or copied candidate data. The static GET route serves an exported JSON payload, so the demo needs no server credentials. All six profiles are returned; search criteria and sorting are applied locally by Talent Desk. Skill coverage evaluates explicit resume mentions and never combines salary/notice into an ability score.

## Future integration

Implement `CandidateProvider.search()` using an authorised server-side provider endpoint. Map the documented official response into Candidate, preserving unknowns and units. Replace the demo provider at the workspace boundary; the cards, filters and shortlist consume the internal model and require no portal-specific response fields. Credentials belong on the server. Update source labels and validate the official schema before enabling real profiles.
