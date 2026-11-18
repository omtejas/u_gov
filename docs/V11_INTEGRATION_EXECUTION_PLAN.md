# U-GOV V11 — Controlled Integration Execution Plan

Date: 2026-11-18
Target branch: `U_GOV_11`
Base: `main` at `e0956ea33076f1d821bed1271e1bddb91ef61b52`

## Objective

Integrate the verified improvements from the user-supplied Google AI Studio V11 export into the original U-GOV repository without replacing the original application, regressing the PR #15 Gemini reliability fix, changing production configuration, or provisioning paid cloud resources.

## Non-negotiable boundaries

- Work only on `U_GOV_11`; never commit to `main`.
- Do not merge the Pull Request.
- Do not trigger a Render deploy or change Render settings.
- Do not edit production secrets or environment variables.
- Do not enable Firebase billing/Blaze or create live cloud resources.
- Do not replace the original application with the AI Studio export.
- Do not import AI Studio-internal metadata or credentials.
- Do not claim tests/builds pass unless they were actually run and their output inspected.
- Preserve all original routes, UI, auth, citizen privacy boundaries, and deployment adapters unless a tested compatibility change is essential.

## Source and baseline

- Source export: `u_gov_v11_by-google_ai_studio.zip`
- Extracted source: `u_gov_v11_ai_studio/`
- Original GitHub baseline: `main` at `e0956ea33076f1d821bed1271e1bddb91ef61b52`
- Integration branch: `U_GOV_11`

## Work sequence

### Stage 0 — Reproducible baseline

1. Check out `U_GOV_11`.
2. Confirm its ancestry is the specified main commit.
3. Install using the repository's existing npm lockfile and `npm ci`.
4. Run existing lint/type-check, tests, and production build before modifications.
5. Record baseline failures separately; do not attribute pre-existing failures to V11.
6. Save a complete file-by-file diff inventory between the AI Studio export and repository. Classify each path as: identical, safe additive, needs adaptation, incompatible, or excluded.

### Stage 1 — G-Bot P0

Integrate only the G-Bot slice first.

1. Adopt the V11 intent categories: greeting, general knowledge, government service, application guidance, document assistance, private citizen workflow, U-GOV navigation, and developer guidance.
2. Add history-aware follow-up routing without carrying private citizen workflow context into general questions.
3. Add whole-word retrieval scoring, stopword filtering, controlled variants, and generic-domain noise suppression.
4. Add the local glossary/verified offline response only after checking every claim and source URL. Do not present unverified statutory limits, document lists, eligibility, fees, SLAs, or deadlines as current legal facts. Label prototype catalogue data clearly.
5. Preserve citizen-specific lookups inside authenticated local tools; never send application IDs, private documents, readiness data, or citizen-specific history to Gemini or public web search.
6. Preserve current `IAIToolGateway` and `AIChatResponse` contracts or migrate all consumers and tests together.
7. Preserve the PR #15 model order and retry policy in `geminiModelConfig.ts`. Do not set AI Studio's injected `gemini-4-hydrogen` as production default.
8. Ensure Gemini health status means what it says: distinguish configured from live-probed/verified.
9. Add the V11 resilience tests, adapting their imports/expectations to the original repository.
10. Add intent/retrieval tests for greetings, short-token false positives, unrelated concepts, follow-ups, private-data isolation, service matching, and offline fallback.
11. Run focused tests, full tests, type-check, and production build. Fix regressions before moving on.

### Stage 2 — Firebase local development only

1. Inspect existing sign-in/authentication paths before introducing Firebase Auth.
2. Make Firebase initialization opt-in. If emulator mode is enabled, connect Auth and Firestore emulators before any operation.
3. In local emulator mode, require a `demo-*` Firebase project ID and fail closed if a real project ID is supplied.
4. Do not initialize Firebase in the production browser bundle unless a documented feature explicitly requires it.
5. Do not silently switch the application's authoritative user/application database from the existing repository.
6. Keep Firebase Storage emulator-only unless there is a separately approved, budgeted design.
7. Use the Firebase Emulator Suite and real rules-unit-testing package for Firestore rules tests; static text assertions are not sufficient.
8. Add clear local-only scripts and a concise README. Do not require global CLI assumptions; declare a reproducible dev dependency only if compatible with the existing npm workflow.
9. Verify no live Firebase project is contacted during local tests.

### Stage 3 — Local PostgreSQL / cloud foundations

1. Treat PostgreSQL Compose as an optional local learning environment, not an application runtime migration.
2. Verify Compose syntax, SQL initialization paths, health checks, port bindings, volume behavior, and local-only credentials.
3. Keep Postgres bound to localhost and never expose it publicly.
4. Clearly state that JSON remains the application's current runtime persistence until a PostgreSQL adapter and migration tests exist.
5. Do not add AWS/GCP resource provisioning or paid service activation.
6. Validate shell and PowerShell scripts; provide safe teardown and data-reset guidance.

### Stage 4 — Dependency and CI reconciliation

1. Keep npm as the deployment package manager because the current Render build uses `npm ci`.
2. Update `package.json` only for dependencies actually used by integrated code.
3. Generate and commit a matching `package-lock.json`; never commit an inconsistent manifest/lockfile pair.
4. Avoid upgrading unrelated packages, especially framework and AI SDK majors, without compatibility tests.
5. Extend CI for the new focused test suites and local configuration checks without making cloud credentials mandatory.
6. Keep secrets out of source, logs, test snapshots, and docs.

### Stage 5 — Final verification and review

Required evidence:
- File-by-file integration summary.
- TypeScript/lint output.
- Full test output.
- Production build output.
- Firebase Emulator rules test output (if Firebase stage is included).
- Docker Compose validation output (if local cloud stage is included).
- Secret/config scan.
- Confirmation that no production config, live Firebase resources, or billing settings changed.
- Known limitations and remaining work.

Open a Pull Request from `U_GOV_11` to `main` only after the implemented scope passes its applicable checks. Prefer a draft PR if any stage remains incomplete. Never merge or deploy without explicit user approval.

## Recommended tooling split

Use a local coding agent/IDE (for example, Antigravity) to inspect the ZIP and working tree, apply multi-file patches, run terminal commands, and capture test output. Use GitHub for branch/commit/PR review. Use a separate reviewer to inspect the diff and test evidence. Do not let multiple agents edit the same branch/files concurrently.

## Completion definition

This work is complete only when the source changes are committed to `U_GOV_11`, tests/build are evidenced, the integration summary is accurate, and a reviewable PR exists. Creating the branch or writing this plan is not source integration.
