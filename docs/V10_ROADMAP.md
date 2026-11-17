# U-GOV V10 — Product Roadmap & Acceptance Criteria

Updated: 2026-11-17  
Baseline: main commit `23ff2a9c7e8a6ecda9b795f83f80c662f44d7b3a`

## Product goal

Turn U-GOV from a visually integrated prototype into a verifiable, reliable citizen-service workspace while preserving the existing modular monolith and making every simulated capability explicit.

## Phase 0 — Release foundation (P0)

- [ ] Fix PR #13 TypeScript regression.
- [ ] Require CI type-check, production build and full test suite to pass.
- [ ] Investigate Netlify preview failure and define the supported preview/production host.
- [ ] Verify Render deploy tracks the approved main commit; do not deploy from V10 branch to production.
- [ ] Separate AI provider configuration from live request health.
- [ ] Reproduce and diagnose Gemini timeout/model errors using safe logs and provider metadata; never log API keys or citizen data.
- [ ] Add a minimal authenticated/unauthenticated smoke-test matrix for critical API routes.

**Exit:** CI green, deployment path understood, health labels truthful, no known P0 blocker hidden.

## Phase 1 — Stitch design system (P1)

- [ ] Inventory supplied Stitch screens and extract tokens, spacing, typography and responsive behavior.
- [ ] Map each design component to existing React components before adding dependencies.
- [ ] Implement shared shell, buttons, cards, inputs, navigation, status badges and empty/loading/error states.
- [ ] Refresh priority screens: login, dashboard, services, U-DOCS, G-Bot and profile.
- [ ] Verify mobile/tablet/desktop, keyboard navigation, focus visibility and contrast.

**Exit:** Shared design tokens/components reused across priority screens; no dead controls or duplicate design systems.

## Phase 2 — U-IDENTITY and Google sign-in (P1)

- [ ] Test GIS ID-token flow against configured authorized origin.
- [ ] Verify nonce, issuer, audience, expiry and verified-email validation.
- [ ] Test new account, existing account, suspended account, session refresh and logout.
- [ ] Keep password accounts unlinked until explicit secure account-linking flow is implemented.
- [ ] Ensure user profile/preferences are persisted and server-authorized.

**Exit:** Automated auth tests plus successful browser E2E test; no account takeover or silent linking.

## Phase 3 — Bharat G-Bot (P0)

- [ ] Verify a real Gemini request in a non-production preview.
- [ ] Record provider, selected model, duration, result category and request correlation ID without secrets or sensitive prompt content.
- [ ] Add deterministic handling for timeout, quota, authentication, model-not-found, empty response and upstream unavailable errors.
- [ ] Keep explicit current-message intent routing and safe contextual follow-ups.
- [ ] Keep private application/document data behind authenticated server tools.
- [ ] Add source-aware responses for official government information; do not invent facts or cite the U-GOV prototype catalogue as an official source.
- [ ] Implement website/activity report workflows only with clear user authorization, scope limits, retention and data minimization.
- [ ] Test prompt injection, private-data isolation, rate limits and abuse cases.

**Exit:** Real Gemini response verified; each failure category is observable and honest; private tools remain ownership-scoped.

## Phase 4 — U-DOCS durable vault and document intelligence (P1)

- [ ] Verify private S3-compatible object storage in a separate preview.
- [ ] Wire PostgreSQL metadata persistence only after schema/repository/migration tests.
- [ ] Ensure upload, download, delete, version history and checksum verification.
- [ ] Verify restart durability, backup/restore and orphan cleanup.
- [ ] Add document text extraction/analysis with strict file limits and untrusted-document prompt isolation.
- [ ] Never use real citizen documents during prototype testing.

**Exit:** Durable private storage and metadata are verified end-to-end; AI analysis cannot bypass owner/consent rules.

## Phase 5 — Government Web Hub (P1)

- [ ] Curate ten official central/state government destinations from primary government sources.
- [ ] Record title, department, official domain, purpose, category, last-verified date and outbound URL.
- [ ] Add search, category filters and concise descriptions.
- [ ] Add admin create/edit/disable workflow with role checks, HTTPS/domain validation and audit trail.
- [ ] Clearly mark outbound navigation; do not imply U-GOV owns or operates linked portals.

**Exit:** Ten destinations verified; admin changes are authorized, validated and audited.

## Phase 6 — Life Bio citizen profile (P1)

- [ ] Define a minimal profile schema and field-level edit permissions.
- [ ] Allow citizens to view/edit their own profile and preferences.
- [ ] Validate fields server-side and audit sensitive changes.
- [ ] Persist data; avoid collecting unnecessary national IDs or sensitive attributes.
- [ ] Add privacy controls and clear save/error states.

**Exit:** Citizen-owned profile edits persist across sessions and cannot be accessed by another user.

## Phase 7 — Release candidate verification (P0)

- [ ] Full unit/integration tests.
- [ ] E2E: sign-in → service discovery → document readiness → application draft → tracking.
- [ ] E2E: G-Bot general question, service query, private workflow and provider failure.
- [ ] Security: IDOR, CSRF, upload validation, SSRF, session and rate-limit checks.
- [ ] Accessibility and responsive browser QA.
- [ ] Performance and dependency audit.
- [ ] Backup/restore and rollback plan.
- [ ] Release notes and known limitations.

**Exit:** Evidence-backed release candidate; production merge/deploy requires explicit approval.

## Scope control

Do not implement all workstreams in parallel. Complete Phase 0 first, then build one end-to-end vertical slice at a time. Any feature without acceptance criteria and an owner remains in Backlog.
