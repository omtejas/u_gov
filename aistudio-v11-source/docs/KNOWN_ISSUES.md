# U-GOV V10 — Known Issues & Release Blockers

Updated: 2026-11-17

## Resolved in Local V10 Workspace Upgrade

- **K-001 (Resolved):** `providerStatus` type definition and `correlationId` handling implemented across `GBotModal.tsx` and `/api/v1/ai/chat`.
- **K-003 (Updated):** Gemini primary candidate set to `"gemini-4-hydrogen"` with deterministic fallback order `["gemini-3.8-flash", "gemini-3.7-flash"]` and `"User-Agent": "aistudio-build"`. Live generation remains dependent on a valid `GEMINI_API_KEY` at runtime.
- **K-008 (Resolved):** User preferences (`/api/v1/preferences`), notifications, grievances, feedback, curated Web Hub portals, and document versions now persist inside `db.ts` atomic storage rather than volatile memory, alongside Profile/Life Bio and individual session revocation.
- **K-011 (Resolved):** Fixed broken frontend `/api/v1/documents/consents/all` path, hydrated services catalogue dynamically, gated authenticated mount fetches, enforced officer attached-document ownership validation, and added strict browser CSRF protection on mutations.

## Open Constraints & Production Deployment Gaps

### K-002 — Production host sync
- Changes in this workspace must go through your normal git review and host release gate before appearing on external Render deployments.

### K-004 — Relational SQL migration (Future)
- Existing SQL DDL schemas (`schema.sql` / `001_v6_lifecycle_foundation.sql`) exist alongside atomic JSON backend persistence and client Firebase Firestore integration. Multi-instance deployments require a managed relational driver when scaling horizontally beyond a single Node instance.

### K-005 — S3 bucket credentials & restore verification
- `S3CompatibleStorageDriver` now enforces HTTP fetch timeouts (`AbortSignal.timeout(10000)`), Node stream uploads/downloads, and HEAD verification. Live bucket persistence depends on configuring S3 environment credentials at deploy time.

### K-006 — Internet search credentials
- External web search grounding requires setting `TAVILY_API_KEY` or `BRAVE_SEARCH_API_KEY`; without keys, G-Bot operates strictly on U-SERVICES and U-DOCS tools with honest disclosures.

## Data safety

Do not use real citizen identity documents, Aadhaar/PAN numbers, bank details, passwords, or OTPs in prototype testing. Use synthetic fixtures only.
