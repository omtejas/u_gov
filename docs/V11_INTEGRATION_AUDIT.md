# U-GOV V11 Integration Audit

**Status:** Initial source audit completed; implementation not yet started  
**Baseline:** `main`  
**V11 reference:** `u_gov_v11_aistudio_integration_v1` (read-only source reference)  
**Integration work:** `u_gov_v11_integration_work`  
**Audit date:** 2026-11-18

## 1. Non-negotiable integration rules

1. Preserve all existing `main` citizen, officer, admin, identity, service, application, document, consent, grievance UI, notification, audit, integration, search, and AI behavior.
2. Do not copy the V11 application wholesale over `main`.
3. Port features in small vertical slices and adapt them to the existing modular React + Express architecture.
4. Keep incomplete or externally dependent capabilities visible only with honest prototype/WIP states and safe feature gates.
5. Backend authentication, authorization, ownership checks, CSRF protections, and audit logging remain authoritative. AI and Firebase client rules never replace Express authorization.
6. No merge to `main`, production configuration changes, or deployment without explicit approval.

## 2. Repository comparison snapshot

- Original `main`: 162 Git tree entries.
- V11 source archive: 209 Git tree entries (including directories and AI Studio working artifacts).
- V11-only source paths include new Web Hub and Profile views/routes, Firebase client setup and rules, local cloud configuration, error boundary, G-Bot retrieval/local knowledge modules, grievance route, and additional tests.
- V11 modifies the existing App, server, AI pipeline, database, auth middleware, multiple UI components/views, styles, types, and configuration.
- The V11 reference branch remains unchanged. Integration work is on this branch, created from `main`.

## 3. Feature-by-feature integration matrix

| Area | Existing main baseline | V11 delta | Decision | Integration status |
|---|---|---|---|---|
| Application shell / routing | Existing authenticated app shell and all current views | React.lazy route loading, Suspense fallback, ErrorBoundary, Web Hub and Profile routes | Merge resilience/performance improvements while retaining every main route and modal | Planned |
| Citizen UI | Existing Home, Services, Dashboard, Documents, Tracker, Consent, Notifications, FAQ, My Data, Grievance, Where Am I | New Profile/Life Bio and Government Web Hub views; updates to navigation, header, components and translations | Port additive views and navigation; regression-check all existing views | Planned |
| G-Bot intent routing | Four broad intents; basic private workflow isolation | Greeting, developer, document, application guidance intents; history-aware routing and safer follow-ups | Adopt after regression tests against all existing intent paths | Planned |
| G-Bot retrieval | Existing catalogue and FAQ lookup with broad matching | Whole-word tokenizer, stopwords, weighted scoring, relevance thresholds, generic-token suppression | Adopt scoring primitives and verify service/FAQ recall and precision | Planned |
| G-Bot knowledge | Existing provider/tool gateway and model fallback | Large verified local glossary, deterministic offline answers, developer/technology knowledge | Port in bounded modules; verify sources, correctness, language behavior and no invented legal advice | Planned |
| G-Bot resilience / telemetry | Existing configured-provider health and deterministic fallback | Error classification, model probe, correlation IDs, offline fallback and runtime telemetry | Adopt truthful status model; never report live provider as responding without a successful probe/request | Planned |
| AI privacy boundary | Existing authenticated chat, private workflow fallback, safe history filtering and controlled tools | Expanded intent routing and local knowledge | Preserve and strengthen; never send citizen-specific private records to external model/search | Planned |
| AI tool gateway | Existing catalogue/FAQ and citizen-scoped tools | Relevance scoring and more selective service discovery | Merge scoring while preserving tool-level authorization and audit events | Planned |
| Authentication / sessions | Existing U-IDENTITY sessions, roles and permissions | CSRF origin/Sec-Fetch validation, rate-limit pruning, session/profile improvements | Review and port security changes without weakening existing session semantics | Planned |
| Preferences | Main server stores preferences in a process-local object | V11 persists preferences through JSON database | Replace volatile store with existing persistent DB API; validate schema and allowed values | Planned |
| Grievances | Main includes Grievance UI but no mounted grievance API route in inspected server baseline | New authenticated grievance API, persistence, notifications, audit, upvotes | Port route + DB methods + tests as one vertical slice; citizen visibility/ownership must be reviewed | Planned |
| Government Web Hub | No equivalent view/route in main | Curated portal directory, admin add endpoint, portal records | Port as additive feature; verify URL allowlist and do not imply government endorsement unless verified | Planned |
| Profile / Life Bio | Existing profile/auth data and preference APIs | New Profile view for profile, preferences, password rotation and session management | Port view only after confirming every API exists and is secure; do not duplicate profile logic | Planned |
| Database / persistence | Atomic JSON store and existing application/document/audit data model | Adds persistent preferences, notifications, feedback, grievances, Web Hub, document versions and revocation support | Adapt DB changes carefully; preserve existing JSON data and migration/backup behavior | Planned |
| Firebase Authentication | Existing U-GOV Express session authentication | Firebase client Auth initialized | Do not replace U-GOV session auth; integrate only where a defined user flow requires it | Review |
| Firestore | No active runtime data path in main | Client SDK, Firestore schema/rules and connectivity probe | Treat as optional separate client capability until actual reads/writes and identity mapping are proven | Review |
| Firebase security rules | No equivalent in main | Default-deny rules and security specification | Inspect deployed rules and run real emulator adversarial tests; current `firestore.rules.test.ts` is a static payload/spec assertion, not proof all 12 attacks were executed | Review |
| Firebase Storage | Existing local/S3-compatible private storage abstraction | Storage rules and emulator configuration | Keep existing U-DOCS storage abstraction authoritative; no direct client upload of private documents without verified ownership/consent design | Review |
| PostgreSQL | SQL schema/migration files exist, runtime currently uses JSON store | Docker Compose starts PostgreSQL 16 and loads SQL files | Local database service is infrastructure scaffolding only: V11 package has no PostgreSQL driver and inspected DB implementation still uses JSON files; do not claim runtime PostgreSQL migration | Review |
| Local cloud / emulators | Existing local Node/Express workflow | Firebase emulator config, local scripts, Docker Compose/Postgres profile | Port as optional local development tooling; verify ports, startup, health and teardown | Planned |
| Deployment / cloud | Existing Render/Netlify/Vercel configs | Firebase/GCP/local-cloud additions and updated env configuration | Keep cloud provisioning optional; no paid resource creation or production changes | Review |
| Tests / CI | Existing individually invoked test suites | Unified isolated test runner, G-Bot resilience, hardening and local-cloud config tests | Preserve all existing tests and add V11 suites; execute against clean isolated data directory | Planned |
| AI Studio artifacts | Not part of main runtime | `.aistudio` implementation plan and temporary media | Retain only in reference archive; exclude from runtime integration | Exclude |

## 4. Important findings and integration risks

### 4.1 PostgreSQL is not yet the application runtime database
V11 adds PostgreSQL 16 Compose configuration and SQL initialization, but its inspected package does not include a PostgreSQL client driver and its database implementation still reads/writes an atomic JSON file. PostgreSQL must be described as a local infrastructure/schema target until an adapter, migrations, transaction behavior, and integration tests are implemented.

### 4.2 Firestore setup is not equivalent to Firestore application integration
V11 initializes the Firebase client and runs a Firestore connectivity probe. The inspected client module does not establish a complete production data-access layer or prove that U-GOV Express sessions map safely to Firebase identities. Firestore rules must be emulator-tested; the current Dirty Dozen test file declares payload cases and checks their count, rather than executing all attack cases against the emulator.

### 4.3 Keep identity boundaries clear
U-GOV's existing Express session remains the source of truth for server APIs. Firebase Auth must not be silently substituted. Any future bridge must explicitly map verified Firebase identity to the U-GOV account and preserve role/permission checks.

### 4.4 Preserve private document boundaries
The existing U-DOCS local/S3 abstraction and server-side ownership checks remain authoritative. Firestore or Storage client rules are additional controls, not permission to expose document metadata, document contents, application IDs, or audit history to AI/search.

### 4.5 Verify AI model claims
V11 changes Gemini model candidates and adds probe/telemetry/fallback logic. A configured API key is not proof of live generation. Tests using fake Gemini clients validate code paths, not live provider availability. Live checks require a valid key and explicit test run.

### 4.6 Check the Profile UI against real endpoints
The Profile view depends on profile updates, preference persistence, password changes, and session revocation. Each operation must be traced to its actual route, authorization, CSRF protection, validation and tests before the view is enabled.

### 4.7 Version/documentation drift
Several V11 source documents identify the workspace as V10 and refer to a `u_gov_v10` branch, while this archive is being used as the V11 source. Normalize documentation only after confirming actual implementation state; do not treat documentation status labels as independent test evidence.

## 5. Implementation sequence and gates

### Phase 0 — Baseline and safety
- Record the exact `main` commit and verify this branch was created from it.
- Keep `u_gov_v11_aistudio_integration_v1` unchanged.
- Install dependencies from the main lockfile and capture baseline typecheck, build and tests.
- Do not overwrite or discard any main-only files.

### Phase 1 — G-Bot quality and resilience
- Port retrieval scoring and expanded intent classification.
- Port local knowledge in a controlled, reviewed dataset.
- Integrate provider fallback/telemetry and correlation IDs.
- Acceptance: greetings/general knowledge never surface random services; service queries return relevant catalogue matches; private citizen queries remain local and user-scoped; follow-ups preserve context safely.

### Phase 2 — Security and persistence
- Port CSRF hardening, rate-limit pruning and DB-backed preferences.
- Review all changed auth/session/database code.
- Acceptance: cross-origin mutations rejected, session and role behavior preserved, user data isolated, JSON store survives restart and test runs do not pollute real data.

### Phase 3 — Additive product features
- Port grievance API and persistence.
- Port Web Hub API/view.
- Port Profile view and session controls.
- Acceptance: all actions call real protected APIs; citizen records are owner-scoped; admin actions are role-gated; no inert controls or false official-integration claims.

### Phase 4 — Optional local cloud foundation
- Add Firebase emulator/rules and Docker Compose/Postgres tooling as optional developer workflows.
- Keep PostgreSQL and Firestore labeled as non-runtime until integration is real.
- Acceptance: clean startup/teardown, emulator security tests actually execute, no secrets committed, existing local app remains usable without cloud services.

### Phase 5 — Verification and PR
- Run typecheck, lint, production build, complete test suite, route/UI regression tests, security tests and local emulator tests where supported.
- Review changed-file diff against main and ensure no original feature was removed.
- Prepare a draft PR with evidence, limitations, screenshots/demo checklist and rollback notes.
- Merge/deploy only after explicit approval.

## 6. Current status

- [x] V11 source archive uploaded and retained on its reference branch.
- [x] Main and V11 directory trees compared.
- [x] Initial architecture and feature delta inspected.
- [x] Integration work branch created from main.
- [x] Initial feature matrix and risk register recorded.
- [ ] Baseline tests executed in a local checkout.
- [ ] Full route/component/API dependency audit completed.
- [ ] Feature implementation started.
- [ ] Integration tests and PR prepared.

**Important:** This audit is a planning and source-inspection artifact. It does not claim that V11 has been integrated or that tests have passed.
