# Your hiring details

Create `frontend/config/my-hiring-details.local.json` from `hr-preferences.example.json`, then edit your name, company and hiring preferences. This local file is ignored by Git and is never copied into the public site. Keep it on your device.

1. Open Talent Desk at `http://127.0.0.1:3002/`.
2. Expand **Your hiring settings** and choose **Import JSON**.
3. Choose your local file. The settings apply to the current browser session.
4. Upload resumes you are permitted to process, then review the detected evidence and edit unknown details only after verification.
5. Export your settings, shortlist and onboarding tasks before refreshing. There is no automatic persistence.

`defaultSkills` is an array such as `["Python", "SQL"]`. `minExperience` is years; `maxNoticeDays` is days; `maxSalaryLpa` is expected annual salary in lakh INR. Use `null` for no upper limit and an empty string for unspecified text. The optional LinkedIn profile URL is a reference only; it does not enable search inside the app.

Do not put passwords, OTPs, cookies, API tokens or session details in this file. Unknown fields are rejected on import. A future live-data connection would need an approved provider integration and a secured server adapter; this static app does not implement one.
