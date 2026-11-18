# V11 Feature-by-Feature Integration Matrix

**Baseline:** main commit e0956ea33076f1d821bed1271e1bddb91ef61b52  
**V11 reference:** u_gov_v11_aistudio_integration_v1/aistudio-v11-source/  
**Integration branch:** u_gov_v11_integration_work  
**Status:** Source-level decisions; implementation has not started.

| Feature | A Status | B Status | Decision | Integration Status | Evidence / Acceptance |
|---|---|---|---|---|---|
| React application shell and navigation | Existing authenticated shell and 15+ views | Lazy loading, Suspense, ErrorBoundary, extra Profile/Web Hub views | MERGE AND IMPROVE | NOT STARTED | Preserve every A route/modal; verify lazy routes and error recovery |
| Citizen service UI | Existing Home, Services, Dashboard, Documents, Tracker and workflow screens | Updated shell/components and service detail UI | MERGE AND IMPROVE | NOT STARTED | Regression-test existing workflows; no mock data presented as live |
| Officer/Admin UI | Existing Officer Desk, Audit and Admin views | Updated role-oriented views and new admin Web Hub operation | MERGE AND IMPROVE | NOT STARTED | Verify RBAC/PBAC and all privileged mutations server-side |
| Bharat G-Bot intent classification | GENERAL_KNOWLEDGE, GOVERNMENT_SERVICE, PRIVATE_CITIZEN_WORKFLOW, UGOV_NAVIGATION | Adds GREETING, DEVELOPER_GUIDANCE, DOCUMENT_ASSISTANCE and APPLICATION_GUIDANCE | MERGE AND IMPROVE | NOT STARTED | Regression cases for greetings, ration explanation, developer questions, service queries and private workflow |
| G-Bot retrieval | Existing service/FAQ lookup and controlled tool gateway | Whole-word tokenizer, stopwords, weighted scoring and relevance thresholds | INTEGRATE B | NOT STARTED | Precision/recall tests; no irrelevant catalogue cards; preserve A tool authorization |
| G-Bot local knowledge | Existing deterministic fallback/provider | Expanded civic/platform/developer/technology glossary | REIMPLEMENT SAFELY | NOT STARTED | Validate source, jurisdiction, dates and factual correctness; citations/limits for legal content |
| G-Bot provider resilience | Existing Gemini/OpenAI provider abstraction and fallback | Additional provider/model handling, probes and telemetry | MERGE AND IMPROVE | NOT STARTED | Distinguish configured vs successful provider; simulate quota, timeout and malformed response |
| AI privacy boundary | Existing private workflow fallback and safe history filtering | Extends intent categories and local knowledge | KEEP A + MERGE AND IMPROVE | NOT STARTED | No private documents, application IDs, citizen history or PII sent to external AI/search |
| AI tool gateway | Existing catalogue, FAQ and citizen-scoped tools | More selective service retrieval and knowledge lookup | MERGE AND IMPROVE | NOT STARTED | Preserve per-tool ownership checks and audit events |
| Authentication/session model | U-GOV Express sessions, hashed tokens, RBAC/PBAC | Firebase client setup plus auth/session changes | KEEP A | NOT STARTED | Express sessions remain authoritative; do not replace with Firebase Auth |
| CSRF/rate limiting hardening | Existing CSRF origin checks and rate limiting | Additional fetch-metadata/origin checks and pruning | MERGE AND IMPROVE | NOT STARTED | Adversarial cross-origin and rate-limit tests; no weakening of existing semantics |
| Profile/Life Bio | Existing profile APIs and profile data | New Profile view, preferences, password and session UI | REIMPLEMENT SAFELY | NOT STARTED | Map every UI action to a real authenticated, CSRF-protected, tested A-compatible endpoint |
| Preferences persistence | In-memory preferences in A server | DB-backed preference methods in V11 | INTEGRATE B | NOT STARTED | Persist across restart; schema validation and allowlisted values; isolated tests |
| Grievances | A has Grievance UI; inspected server does not mount a grievance API | Adds grievance API, persistence, notification and audit | INTEGRATE B | NOT STARTED | Vertical slice: owner scoping, status filtering, upvotes, audit and notification tests |
| Government Web Hub | No equivalent view/route found in inspected A server | New portal directory API/view and admin add operation | INTEGRATE B | NOT STARTED | Validate URLs/redirects and domain ownership; admin-only mutation; distinguish curated from verified |
| Notifications | A notification route uses process-local in-memory records | V11 adds DB-backed notification capabilities | MERGE AND IMPROVE | NOT STARTED | Persistence, multi-instance behavior, per-citizen isolation and migration tests |
| Feedback | Existing feedback route | Additional persistence/feedback changes | MERGE AND IMPROVE | NOT STARTED | Preserve API contracts; validate ownership, moderation and audit behavior |
| Database metadata store | A uses atomic JSON metadata store; PostgreSQL is documented as planned | V11 extends JSON DB methods and adds PostgreSQL schema/Compose | KEEP A + INTEGRATE B; DEFER PostgreSQL runtime | NOT STARTED | Keep JSON runtime until adapter/migrations/transactions are proven; Compose is not DB integration |
| PostgreSQL runtime adapter | Not implemented; .env.example says DATABASE_URL not yet consumed | Schema and local PostgreSQL service; no PostgreSQL client in V11 package | DEFER WITH DOCUMENTATION | NOT STARTED | Do not claim active PostgreSQL persistence; future adapter requires migration/rollback/integration tests |
| Firebase Auth | Express session identity in A | Firebase client SDK setup | REJECT AS IDENTITY REPLACEMENT | NOT STARTED | Only consider an explicit verified identity bridge; Express auth remains authoritative |
| Firestore data layer | No runtime Firestore data path found in A | Firebase initialization, rules and connectivity probe | DEFER WITH DOCUMENTATION | NOT STARTED | No production Firestore claim until data access layer, identity mapping and emulator tests exist |
| Firestore security rules | Server-side Express auth and ownership controls | Default-deny rules and 12-payload assertion spec | REIMPLEMENT SAFELY | NOT STARTED | Existing test asserts payload count; must execute real emulator allow/deny tests |
| Firebase Storage | A local/S3 private document storage abstraction | Storage rules/emulator configuration | KEEP A; DEFER FIREBASE STORAGE | NOT STARTED | U-DOCS storage abstraction remains authoritative; no client exposure of private files |
| Local cloud tooling | Existing Node/Express local workflow | Docker Compose PostgreSQL and Firebase emulator config/scripts | INTEGRATE B AS OPTIONAL | NOT STARTED | Clean startup/teardown, localhost-only ports, no cloud billing or production mutation |
| Cloud deployment templates | Existing Render/Netlify/Vercel config | Additional Firebase/GCP/local cloud files | DEFER WITH DOCUMENTATION | NOT STARTED | Templates remain optional; validate before claiming deployability or provisioning resources |
| Test suite | A has sequential explicit test command | V11 unified test runner and new AI/cloud/hardening suites | MERGE AND IMPROVE | NOT STARTED | Run all A tests plus selected V11 tests; report actual outcomes |
| AI Studio artifacts | Not part of A runtime | .aistudio project artifacts and working metadata | REJECT FROM RUNTIME | NOT STARTED | Keep in immutable source archive; do not add to production bundle |
| Mock/demo data | A contains prototype catalogue/demo semantics | V11 contains mock application/audit/document/service data | KEEP ONLY WITH EXPLICIT DEMO LABELS | NOT STARTED | Never imply simulated records or integrations are live government records |

## Decision principles

1. A's current user/session/data ownership model remains canonical until a migration is implemented and tested.
2. Port features as vertical slices (UI + route + service + persistence + tests), not isolated copied files.
3. Keep V11 source branch immutable.
4. New screens remain disabled or clearly marked WIP until every action has a real API and security coverage.
5. PostgreSQL/Firebase are not considered runtime-integrated merely because configuration, schema or emulator files exist.
6. Any decision marked DEFER or REJECT must be reflected in final known-limitations documentation.

## Evidence status

This matrix is based on source inspection, including A's server.ts, src/App.tsx, AI provider/router, middleware, database and storage modules, plus V11's corresponding AI, database, auth, routes, views, Firebase and Docker files. It is not a runtime test report. All implementation statuses remain NOT STARTED until code and tests prove otherwise.