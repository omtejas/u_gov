# U-GOV V10 — Known Issues & Release Blockers

Updated: 2026-11-17

## P0 — Must resolve before a V10 release

### K-001 — PR #13 TypeScript regression
- Evidence: GitHub Actions run https://github.com/omtejas/u_gov/actions/runs/44083152155
- Failure: `src/components/ai/GBotModal.tsx(280,221)`: `providerStatus` does not exist on the declared `aiHealth` state type.
- Impact: type-check failed; production build and tests were skipped by the workflow.
- V10 action: add `providerStatus?: string` to the health-state type and require CI to pass.

### K-002 — Render production is behind GitHub main
- Latest checked Render live commit: `155b15a6b41b9f038264bdaec4cfd3746a9372a5`.
- GitHub `main` after PR #14: `99440b4946f9040108d3da2eb65d47324aa7d097`.
- Impact: PR #13 changes are not confirmed live.
- V10 action: inspect Render auto-deploy and service events; deploy only after explicit release approval; verify exact commit and smoke tests.

### K-003 — Gemini production response not verified
- Render logs on the deployed commit explicitly returned HTTP 404 / `NOT_FOUND`: `models/gemini-2.5-flash` is unavailable to new users; Google instructed migration to `models/gemini-3.8-flash`.
- The deployed code is older than `main`; the newer code already defaults to 3.8 Flash but still allows a stale `GEMINI_MODEL` value to be tried first.
- V10 branch fix: always try stable `gemini-3.8-flash` first, ignore the retired 2.5 Flash override, then try 3.7 and 3.6 Flash; add deterministic unit tests and release diagnostics.
- Remaining verification: confirm API key validity, project/API access, quota and a successful real response after the fix is deployed. No secret values are logged or displayed.

## P1 — Important platform gaps

### K-004 — Runtime metadata database is JSON-file based
- Existing SQL schema and additive migration are not wired to runtime repository reads/writes.
- No PostgreSQL client dependency or provisioned Render PostgreSQL instance was verified in the V6 audit.
- Impact: relational transactions, multi-instance consistency and robust recovery are not established.
- V10 action: design and test PostgreSQL adapter, migration runner and safe demo-data import before enabling it.

### K-005 — Production document durability not verified
- S3-compatible driver exists, but no production private bucket credentials or successful live object upload/download were verified.
- Render previously reported ephemeral demo storage.
- Impact: files may be lost on restart/redeploy in demo mode.
- V10 action: configure a separate preview environment, verify private storage, backup and restore before real-data claims.

### K-006 — Internet search is not configured
- Production UI reports internet search not configured.
- Impact: G-Bot cannot claim to have searched current external sources.
- V10 action: choose and configure a search provider on a non-production preview first; cite official sources and label prototype data.

### K-007 — Google sign-in end-to-end test outstanding
- Google client configuration endpoint previously reported enabled and the button rendered.
- Successful browser authentication, new-account flow, existing-account behavior and logout have not been evidenced.
- V10 action: run authorized browser tests; do not silently link existing password accounts by email.

### K-008 — User profile and chat persistence are limited
- Preferences endpoint currently uses an in-memory object.
- G-Bot conversation history is browser-local.
- Impact: preferences/chat do not reliably synchronize across sessions/devices and may be lost on process restart.
- V10 action: persist approved profile/preferences and any future chat history with explicit retention and privacy controls.

### K-009 — Netlify preview checks failed on PR #13
- Netlify checks reported deployment failure; details need inspection in Netlify logs.
- Render is the current production hosting path. Netlify preview is not a release gate unless that hosting path is intentionally retained.
- V10 action: clarify supported deployment targets and remove stale/unused preview integration only after confirming repository intent.

### K-010 — Dependency vulnerabilities
- Earlier CI install output reported 5 npm audit findings (1 moderate, 3 high, 1 critical).
- V10 action: run a current audit, trace affected direct/transitive dependencies, update safely and rerun regression tests. Do not run blanket `npm audit fix --force`.

## Data safety

Do not use real citizen identity documents, Aadhaar/PAN numbers, bank details, passwords or OTPs in prototype testing. Use synthetic fixtures only. Do not send private document content or private application records to hosted AI providers unless a separately reviewed, explicitly authorized design supports it.
