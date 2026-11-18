# U-GOV Integration Baseline — A × B

**Audit date:** 2026-11-18  
**Repository:** `omtejas/u_gov`  
**Baseline A:** `main` at `e0956ea33076f1d821bed1271e1bddb91ef61b52`  
**V11 reference B:** `u_gov_v11_aistudio_integration_v1` (source under `aistudio-v11-source/`)  
**Integration branch:** `u_gov_v11_integration_work`  
**Status:** Static source inspection recorded; runtime baseline remains NOT TESTED.

## 1. Branch and source integrity

- `main` exists and is the original application baseline.
- `u_gov_v11_aistudio_integration_v1` exists and contains the V11 source archive.
- `u_gov_v11_integration_work` exists and compares as 2 commits ahead / 0 behind `main`.
- The integration branch currently differs from `main` only in `.github/workflows/verify.yml` and `docs/V11_INTEGRATION_AUDIT.md`; no application source has yet been ported.
- The V11 branch compares as 1 commit ahead / 0 behind `main`, with the archive added under `aistudio-v11-source/`.
- The V11 source reference has not been modified during this inspection.

## 2. A — Original application architecture

### Verified technology from `main/package.json` and `vite.config.ts`

- React 19 and React DOM 19.
- TypeScript 5.8.
- Vite 6 with React and Tailwind CSS v4 plugins.
- Express 4 server.
- Google GenAI SDK `@google/genai ^2.4.0`.
- Node-side TypeScript execution via `tsx`; server bundle via `esbuild`.
- Runtime build command: `vite build && esbuild server.ts --bundle --platform=node --format=esm --packages=external --sourcemap --outfile=dist/server.js`.
- Start command: `node dist/server.js`.
- Test command is an explicit sequential list of test files in `package.json`.

### Verified application structure and flows

- `server.ts` creates the Express application, applies security headers and JSON parsing, normalizes Netlify function paths, mounts session authentication, and mounts API routers for identity, documents, services, applications, integrations, AI, search, notifications, feedback, FAQ and officer workflows.
- `src/App.tsx` composes the existing authenticated UI shell and citizen/officer/admin views, including Home, Services, Dashboard, Documents, Tracker, Consent, Notifications, FAQ, My Data, Grievance, Where Am I, Officer Desk, Audit and Admin. It also mounts the Bharat G-Bot and workflow modals.
- Existing server-side identity uses U-GOV sessions, hashed session tokens, user status, profile, roles and permissions. Route guards include authentication, role and permission checks.
- Existing AI provider contracts expose a provider abstraction and a tool gateway for service search, knowledge search, service details, requirements and citizen-scoped application/document workflows.
- Existing Gemini provider classifies intent, routes private citizen workflows to the deterministic fallback, conditionally retrieves catalogue data for government-service intent, and filters private history before sending conversation context to Gemini.
- Existing storage has a local/S3-compatible driver abstraction and health checks.
- `src/server/database/db.ts` is the current metadata store implementation; see persistence finding below.

### Existing product/security capabilities to preserve

The README and source describe U-IDENTITY, U-AUDIT, U-DOCS, U-CONSENT, U-SERVICES, U-APPLICATIONS and U-INTEGRATIONS. The README explicitly discloses that government connections are a secure sandbox/prototype and that live integrations require official APIs, authorization, credentials, contracts and approvals. This disclosure must remain.

## 3. B — V11 source architecture and observed deltas

The uploaded archive is located at `aistudio-v11-source/`. The earlier repository comparison recorded 170 uploaded files; the Git tree includes additional directory entries and reports 209 tree entries for the archive subtree comparison.

### Verified V11 package differences

- V11 retains the same broad React/Vite/Express/TypeScript stack and the same build/start command shape.
- V11 package upgrades `@google/genai` from `^2.4.0` to `^3.5.0`.
- V11 adds Firebase client/admin SDKs, Firebase security tooling, ESLint, emulator scripts and local-cloud scripts.
- V11 changes the test command to `tsx src/server/tests/run-all.ts`.
- These dependency changes are not approved for wholesale adoption; check API compatibility, lockfile integrity, build, runtime and security before selecting any upgrade.

### Verified V11 feature additions/improvements

- Expanded AI intent taxonomy: greeting, general knowledge, government service, application guidance, document assistance, private citizen workflow, U-GOV navigation and developer guidance.
- Dedicated retrieval module with whole-word matching, stopwords, weighted relevance scoring and minimum thresholds.
- Local knowledge/glossary module with civic, platform, developer and technology categories.
- Additional AI provider resilience and model configuration/telemetry paths (require runtime verification).
- New Grievance API route and persistence methods.
- New Government Web Hub API/view.
- New Profile/Life Bio view with profile, preferences, password and session-management workflows (each endpoint must be verified before enabling the view).
- Additional database fields/methods for preferences, notifications, feedback, grievances, Web Hub and document lifecycle capabilities.
- Firebase client setup, Firestore rules and Storage rules.
- Docker Compose PostgreSQL 16 service and Firebase emulator configuration.
- Additional tests for AI resilience, local-cloud configuration and hardening.

## 4. Key architecture and compatibility findings

### 4.1 Persistence mismatch — high priority

A's `.env.example` explicitly states PostgreSQL is a planned runtime target and that `DATABASE_URL` is not yet consumed by the metadata store. The existing database module uses the JSON-store implementation. V11 adds PostgreSQL Compose/schema assets, but its package manifest does not list a PostgreSQL client driver. Therefore PostgreSQL Compose and SQL schema are infrastructure scaffolding, not proof of PostgreSQL-backed runtime persistence.

**Decision:** Preserve A's current persistence semantics during feature porting. Do not claim PostgreSQL is integrated until a real adapter, migrations, transaction/locking strategy, migration/rollback path and integration tests exist.

### 4.2 Firebase identity/data boundaries — high priority

V11 adds Firebase SDK setup and rules, but this is not equivalent to a complete production data-access layer or a verified mapping between Firebase identities and U-GOV Express sessions.

**Decision:** Keep U-GOV Express sessions and server-side authorization authoritative. Firebase services remain optional and gated until identity mapping, data ownership, rules, emulator tests and operational requirements are proven.

### 4.3 Firestore security test limitation

The inspected V11 `firestore.rules.test.ts` declares 12 adversarial payload cases and asserts that the list contains 12 cases. It does not, by itself, execute those operations against the Firebase emulator or prove the rules deny them.

**Decision:** Treat the file as a security test specification, not as evidence that the 12 attacks have been executed. Implement actual emulator-based rule tests before claiming PASS.

### 4.4 Grievance API mounting

V11 includes `src/server/routes/grievances.ts`; A's inspected `server.ts` does not mount a grievance router. A already has a Grievance UI view, so route/UI alignment must be inspected before enabling or porting API calls.

**Decision:** Port as a vertical slice only after checking current UI expectations, persistence, owner scoping, authorization, notification and audit behavior.

### 4.5 Profile view endpoint dependencies

The V11 Profile view calls profile update, preferences, session listing/revocation and password-related flows. The entire dependency chain must be mapped to actual A routes and validated for CSRF, authentication, ownership and rate limiting.

**Decision:** Do not enable the Profile view as a standalone file copy. Integrate only with real, tested endpoints.

### 4.6 AI provider version and behavior

V11 changes the Gemini SDK major/minor line and AI routing/retrieval behavior. A already has an intent router and privacy boundary. V11 must be merged at the behavior/module level, not copied wholesale. The local glossary must be reviewed for source accuracy, legal freshness and jurisdictional assumptions before it is treated as authoritative.

**Decision:** Prioritize deterministic intent/retrieval improvements and offline behavior; preserve A's private citizen workflow isolation and tool authorization. Do not send private citizen records to external AI/search.

### 4.7 UI and mock-data boundary

V11 contains new views and data/context modules. Any mock records or client-side demo state must not be presented as persistent government data or live government service connectivity.

**Decision:** Reuse design/component ideas selectively; connect every enabled action to a real protected API or label it Demo/WIP.

## 5. CI, build and test baseline

### CI workflow observed on `main`

The GitHub Actions workflow:
1. Runs on pull requests targeting `main`.
2. Also runs on pushes to legacy branches `u_gov_v3`, `u_gov_v4`, `u_gov_v6`.
3. Uses Ubuntu 24.04 and Node.js 22.
4. Runs `npm ci --include=dev`.
5. Runs `npm run lint` (TypeScript `tsc --noEmit`).
6. Runs `npm run build`.
7. Runs `npm test`.

### Runtime baseline status

| Check | Status | Evidence |
|---|---|---|
| Source/package/config inspection | PASS (static inspection only) | Files fetched from both refs |
| Dependency installation | NOT TESTED | Requires clean checkout/runtime |
| TypeScript check | NOT TESTED | Requires Node/npm execution |
| Production build | NOT TESTED | Requires Node/npm execution |
| Existing A test suite | NOT TESTED | Requires isolated local checkout and data directory |
| V11 test suite | NOT TESTED | Archive test runner not executed |
| API/UI functional regression | NOT TESTED | Requires running application and test accounts |
| Security/IDOR/CSRF tests | NOT TESTED | Requires isolated runtime and adversarial tests |
| Firebase emulator rules tests | NOT TESTED | Existing V11 file is a payload specification, not emulator execution |
| Live Gemini generation | NOT TESTED | Requires valid provider credentials and an explicit live request |

No build/test PASS is claimed in this baseline. A GitHub source inspection cannot substitute for running the commands.

## 6. Known risks and baseline defects to address

1. In-memory preferences in A's `server.ts` are lost on process restart; V11 adds DB-backed preference persistence.
2. A's notification route describes an in-memory notification store; assess persistence and multi-instance behavior.
3. PostgreSQL is configured/documented but not yet the runtime metadata store.
4. Render's local filesystem may be ephemeral unless a persistent disk or external storage is configured; verify actual production settings before claiming durability.
5. V11 Firebase assets need emulator-backed security verification and explicit identity mapping.
6. V11's Firestore adversarial test file is currently a static specification.
7. V11's Web Hub verification flag is based on hostname suffix; review official-domain validation, redirect safety and admin curation before treating portals as verified.
8. V11's local glossary contains statutory/legal descriptions that require source/date/jurisdiction validation before production use.
9. V11's additional package dependencies and Gemini SDK change require compatibility and supply-chain review.
10. Existing AI health/configuration indicators must distinguish configured provider from a successful live provider request.

## 7. Phase 0 completion gates

The following remain open before Phase 0 can be marked PASS:

- Obtain a clean local checkout of `main` and integration branch.
- Run and capture A's `npm ci --include=dev`, `npm run lint`, `npm run build` and `npm test`.
- Run V11 checks in a separate isolated worktree/container without modifying the reference branch.
- Inspect all remaining source files and map every API/UI/database dependency for each V11-only feature.
- Confirm current Render storage and environment configuration read-only.
- Record the exact test output, commit SHA and environment versions.

**Current conclusion:** The source-level baseline identifies a compatible common stack and clear integration opportunities, but persistence, Firebase, AI SDK, profile/grievance endpoint and security-test gaps make wholesale replacement unsafe. Continue with a behavior-level, vertical-slice integration on `u_gov_v11_integration_work` only.
