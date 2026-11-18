# U-GOV V11 AI Studio Import — Integration Audit

Date: 2026-11-18

## Baseline

- Repository: https://github.com/omtejas/u_gov
- Base branch: `main`
- Base commit: `e0956ea33076f1d821bed1271e1bddb91ef61b52`
- Integration branch: `U_GOV_11`
- Source: user-supplied Google AI Studio V11 ZIP

The AI Studio export is a separate workspace snapshot. It is not a Git history continuation of the repository. Its files must be selectively reconciled with the repository; replacing the repository wholesale would risk losing original UI, routes, middleware, and deployment work.

## Verified source-export additions

The supplied export includes, among other files:

- `src/server/ai/retrieval.ts`
- `src/server/ai/localKnowledge.ts`
- `src/server/tests/gbot-resilience.test.ts`
- `src/server/tests/m1-local-cloud-config.test.ts`
- `src/lib/firebase.ts`
- `firebase.json`, `firebase-applet-config.json`, `.firebaserc`
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- `docker-compose.yml`
- `scripts/cloud/local-cloud.sh` and `scripts/cloud/local-cloud.ps1`
- additional route/view/context files and documentation

The ZIP contains 170 extracted files. The archive includes an AI Studio project snapshot, not a verified commit from the repository.

## Material differences and risks

### 1. Gemini model portability

Repository `main` uses:
- Primary: `gemini-3.8-flash`
- Fallbacks: `gemini-3.7-flash`, `gemini-3.6-flash`

The AI Studio export changes this to:
- Primary: `gemini-4-hydrogen`
- Fallback: `gemini-3.1-flash-lite`

The AI Studio-injected model name must not become the production default. Keep the repository's externally portable model strategy unless the model is independently verified for the target API and deployment.

### 2. Firebase integration is not yet an application data migration

The export adds Firebase client initialization and Firebase Emulator configuration. Its Firebase client currently initializes Auth and Firestore, but the audit does not establish that existing Express/JSON-backed application workflows have been migrated to Firestore. Do not change the authoritative application data store as part of a configuration import.

The export's Firebase config references the AI Studio project and a separate demo emulator project. Ensure local emulator mode is explicit and cannot silently connect to a live project.

### 3. Firebase Storage billing boundary

The local Storage Emulator is suitable for zero-cost development. Do not provision or rely on a live Firebase Storage bucket under the strict zero-budget constraint. Do not enable Firebase Blaze or link a billing account.

### 4. PostgreSQL remains optional until an adapter exists

The export adds a PostgreSQL Compose service and setup scripts. The original repository's runtime database remains JSON-backed. Compose configuration alone does not implement a PostgreSQL repository adapter or data migration. Keep JSON as the default until a separately tested adapter is implemented.

### 5. Compose security and portability

The supplied Compose file includes a local-development fallback password and host-bound ports. Keep it strictly local, document that fallback credentials are development-only, and ensure no cloud deployment workflow consumes them. Validate Compose against the exact schema and verify the referenced SQL files exist.

### 6. Dependency reproducibility

The export contains `bun.lock` but no `package-lock.json`, while the existing Render build uses `npm ci`. The export's `package.json` adds Firebase packages and changes the Google GenAI dependency version. Do not replace the repository package manifest/lockfile until a consistent npm lockfile is generated and the CI/Render install path is verified.

### 7. Source overlap

The repository has a more complete original UI and application structure than the AI Studio export in several areas. The export also contains additional routes and views. Integrate file-by-file; do not delete original repository files simply because they are absent from the ZIP.

## Required integration sequence

1. Reconcile the full source tree against this branch's base commit.
2. Integrate the G-Bot intent/retrieval improvements while preserving the repository's Gemini provider contract and portable model order.
3. Integrate Firebase Emulator configuration as opt-in local development only; keep production Firebase disconnected until explicit approval.
4. Add local PostgreSQL Compose support only after validating SQL paths, ports, health checks, and local-only credentials. Do not claim PostgreSQL runtime support.
5. Generate a lockfile compatible with the existing npm/Render workflow.
6. Run type-check, full tests, production build, and emulator/Compose checks where tooling is available.
7. Produce a draft PR for review. Do not merge, deploy, change Render, enable billing, or provision cloud resources.

## Verification status at import

- ZIP extracted and inspected.
- GitHub `main` commit verified.
- Branch `U_GOV_11` created from `main`.
- No application source files have been integrated yet.
- Dependency installation could not be completed in the available execution window.
- No tests or production build are claimed as passing.
- No cloud resources or billing settings changed.

This report intentionally records the integration gates rather than presenting unverified AI Studio claims as repository facts.
