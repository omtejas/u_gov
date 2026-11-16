# U-GOV V6 implementation status

## Branch and safety boundary

- Development branch: `u_gov_v6`
- Base: `main` at the V6 branch creation point
- V6 changes must remain on this branch until explicitly approved.
- Do not merge to `main`, change the production Render service branch, or deploy V6 without a separate approval.

## Approved target architecture

- Modular monolith: existing Express API and React client.
- PostgreSQL for durable relational state.
- Private S3-compatible object storage for document binaries.
- PostgreSQL stores document metadata, ownership, consent, version and audit references; object storage stores opaque-keyed binaries.
- Sandbox government adapters remain clearly identified as simulations.

## Implemented in this branch so far

1. Added an S3-compatible private object storage driver using AWS Signature Version 4 request signing. No public ACLs or public object URLs are created.
2. Added `UGOV_STORAGE_TYPE=local|s3` driver selection while retaining local storage as the default for existing development/test flows.
3. Added additive V6 SQL migration `src/server/database/migrations/001_v6_lifecycle_foundation.sql` for document versions, consent access logs, application events, durable notifications, service document requirements, grievances, knowledge resources and provider health history.

## Required environment for S3 storage

Set the following only on a V6-specific deployment after provisioning a private bucket:

- `UGOV_STORAGE_TYPE=s3`
- `UGOV_S3_ENDPOINT` (HTTPS endpoint)
- `UGOV_S3_BUCKET`
- `UGOV_S3_REGION`
- `UGOV_S3_ACCESS_KEY_ID`
- `UGOV_S3_SECRET_ACCESS_KEY`
- Optional: `UGOV_S3_SESSION_TOKEN`

The object store must have private access, encryption at rest, lifecycle/backup policy and least-privilege credentials. Do not use real citizen documents in the prototype.

## Database migration status

The current runtime database in the inherited application is a JSON-file store. The V6 SQL migration is an additive schema foundation only; it is not yet wired into runtime reads/writes and does not migrate existing JSON records. PostgreSQL runtime adapter, migration runner, data conversion, transaction boundaries and integration tests remain required before V6 can be described as PostgreSQL-backed.

The repository lockfile currently has no PostgreSQL client dependency. Add the selected PostgreSQL client and regenerate the lockfile in an environment with package registry access before enabling PostgreSQL at runtime.

## Next implementation sequence

1. Add PostgreSQL client dependency and typed pool/repository layer; make startup fail closed when production is configured for PostgreSQL but connectivity/migrations fail.
2. Add ordered migration runner with checksums and transactional application.
3. Convert existing identity, sessions, profiles, documents, consent, applications, services and audit persistence behind repositories.
4. Add explicit import/export migration for demo JSON records; never import seeded demo identities as real citizens.
5. Persist document version metadata and use object storage for every version; add cleanup/reconciliation for orphaned objects.
6. Move notifications and application events to PostgreSQL.
7. Add API/UI flows for version history, consent access history, event timelines and notification inbox.
8. Add migration, restart durability, ownership/IDOR, consent expiry/revocation, storage integrity and API regression tests.
9. Configure a separate V6 Render preview/service and PostgreSQL instance. Do not repoint the existing V5 service.
10. Review deployment plan and costs with the user before provisioning or applying infrastructure changes.

## Verification

A code checkout and test execution could not be run in the current execution environment because outbound GitHub network access is unavailable. GitHub branch writes were accepted by the repository API; this is not equivalent to a successful build or test run. Re-run `npm ci`, `npm run lint`, and `npm test` in CI before deployment.


## Additional V6 increment — Bharat G-Bot and visual refresh

Implemented on `u_gov_v6`:
- Added configurable OpenAI-compatible and Gemini provider selection.
- Added Tavily page-content search and Brave web search adapters.
- Added bounded recent-chat context and contextual follow-up search queries.
- Added public FAQ knowledge retrieval to the controlled AI gateway.
- Added source citations in the AI API response, distinguishing U-GOV FAQ and Internet sources.
- Replaced generic offline fallback messaging with an honest explanation of missing hosted AI configuration.
- Redesigned G-Bot as a conversation workspace with per-user browser-local chat history, conversation switching and deletion.
- Established the V6 blue/red/green/white/black/yellow design tokens and multilingual font stack.
- Refreshed the citizen landing page, dashboard accents, header, navigation, footer and floating G-Bot entry point.

Limitations:
- Internet search and extracted webpage content require Tavily or Brave credentials; hosted AI requires an OpenAI-compatible or Gemini key.
- Browser-local chat history is not server-side and does not synchronize across devices.
- FAQ and service catalogue are the current internal knowledge sources; a complete crawler/index of every platform page is not yet implemented.
- Several remaining modules still require a full visual redesign.
- No build, lint, test suite, browser QA or preview deployment has been run for this increment. GitHub API acceptance is not proof of compilation or runtime correctness.


## Verification update — 2026-11-17

- GitHub Actions run: https://github.com/omtejas/u_gov/actions/runs/43934816288
- Verified commit: `6a09030c95e48521a371fa6c90e0a1a4f120c12b`
- `npm ci`: passed
- `npm run lint` (TypeScript): passed
- `npm run build`: passed
- `npm test`: passed
- This does not verify external provider credentials, visual browser QA, responsive device testing or a deployed V6 preview.
