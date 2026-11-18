# U-GOV V10: Bharat G-Bot Reliability, AuthView Error Recovery & Audit Handover Plan

This plan details the root-cause remediation for Bharat G-Bot inconsistent AI responses, upgrades the citizen sign-in experience with descriptive progress states and inline error recovery, and establishes the evidence-verified workflow for delivering the 13-section Implementation Audit & Handover Report.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following three implementation decisions were confirmed during clarification and govern all execution steps:

- **Confirmed Decision 1 (Execution Sequence)**: Implement and verify the Bharat G-Bot reliability fixes and AuthView error-recovery UX first, then perform end-to-end verification and deliver the complete 13-section Implementation Audit & Handover Report.
- **Confirmed Decision 2 (Gemini Unavailable Fallback Policy)**: When live Google Gemini generation is unavailable (missing key, quota limit, timeout, or upstream failure), Bharat G-Bot responds using verified local U-GOV knowledge (service catalogue, FAQ knowledge entries, and statutory glossary) with an explicit offline attribution label—never misrepresenting offline fallback content as `"Google Gemini"`.
- **Confirmed Decision 3 (AuthView Failure & Loading Feedback)**: Authentication errors render inside an inline status banner featuring clear failure copy and a functional **Retry** button, paired with descriptive multi-stage loading feedback during submission.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Reliable Bharat G-Bot Pipeline**: Aligns intent routing, catalogue/FAQ knowledge retrieval, model fallback (`gemini-4-hydrogen` → `gemini-3.1-flash-lite`), per-request diagnostics, truthful health probing, and verified offline knowledge fallback so citizen queries such as *"What is Aadhaar?"*, *"What IS SIH"*, *"What IS Ration"*, *"What is U-GOV?"*, *"What is DigiLocker?"*, *"What is PM-KISAN?"*, and multi-language queries (`en`, `hi`, `mr`, `kn`) behave consistently and transparently.
  2. **Resilient Citizen Authentication (`AuthView`)**: Replaces static network error boxes with contextual retry controls and clear stage indicators so citizens understand whether credentials are being verified, sessions established, or workspaces loaded.
  3. **Evidence-Based Technical Handover**: Produces a rigorous 13-section technical audit report backed by measured runtime tests, build/lint/security audits, and Playwright browser checks, stopping immediately afterward for external review.
- **Target Audience / Persona**: Citizens accessing digital public services and external technical reviewers evaluating architecture, AI reliability, persistence, and security posture.
- **Key Value**: Eliminates silent failures and false provider attribution in Bharat G-Bot, recovers gracefully from transient sign-in network issues, and gives reviewers an unambiguous, evidence-grounded baseline.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Citizen Sign-In & Error Recovery**:
     - Citizen enters credentials (or clicks demo citizen/admin/auditor autofill) and submits.
     - Button and live region (`role="status"`) step through clear progress messages (*"Verifying credentials…"* → *"Establishing secure session…"*).
     - On network or gateway failure, an inline status banner (`role="alert"`) appears directly above the action area explaining the cause alongside a **Retry sign-in** button that re-executes the last attempted sign-in payload (`password` login, registration, or Google credential verification) and a dismiss control.
  2. **Bharat G-Bot Conversational & Offline Flow**:
     - Opening Bharat G-Bot fetches live readiness telemetry (`GET /api/v1/ai/health`) showing verified status (`Hosted AI active` / `Offline local knowledge mode` / `Checking readiness`).
     - Citizen submits a query in `en`, `hi`, `mr`, or `kn`.
     - If Gemini succeeds (primary or fallback model), response displays the verified attribution (`Google Gemini` plus any catalogue or web citations).
     - If Gemini is unreachable or times out, Bharat G-Bot serves matching verified local U-GOV knowledge (service catalogue card details, FAQ guide, and statutory terminology breakdown) stamped explicitly as **"U-GOV Verified Local Knowledge (Offline — Live Gemini unavailable)"**, accompanied by a **"Retry with Live AI"** action button on that message.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Crisp, authoritative Civic Workspace & Enterprise SaaS posture—high contrast, structured grid alignment, and zero visual bloat.
  - *Color Palette & Mood*: Primary governance blue (`#174EA6`), deep navy authority panel (`#0B1F3A`), clean canvas (`#FFFFFF` / `#F7F9FC`), saffron accent (`#F4C95D`), and strict semantic state tokens (`#16A34A` green active, `#D97706` amber warning/offline notice, `#DC2626` crimson alert/error).
  - *Typography & Hierarchy*: Clean sans hierarchy (`Plus Jakarta Sans` / `Public Sans`) paired with strict `tabular-nums` / monospace telemetry for timestamps, reference IDs, latency metrics, and status badges.
  - *Component Styling & Layout*: Single-elevation surfaces with crisp 1px borders (`border-slate-200`), zero nested card shadows, zero decorative pill clutter on static metadata, and WCAG AA contrast across alert banners (`bg-rose-50 text-rose-900 border-rose-200` for errors; `bg-amber-50 text-amber-900 border-amber-200` for offline knowledge notices).
- **Interactive Feedback & Motion**:
  - Descriptive multi-stage loading copy (`aria-live="polite"`) without layout shift.
  - Actionable retry controls both in `AuthView`'s inline error banner and on offline/unavailable G-Bot replies.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Broaden Local Knowledge Retrieval Across General, Navigation, and Service Intents**
  - *Chosen Approach*: Allow Bharat G-Bot's grounded knowledge lookup (FAQ database, U-SERVICES catalogue, and statutory glossary) to run across `GENERAL_KNOWLEDGE`, `UGOV_NAVIGATION`, and `GOVERNMENT_SERVICE` intents rather than gating FAQ lookup narrowly to a small navigation regex.
  - *Why*: Queries like *"What IS Ration"*, *"What IS SIH"*, *"What is Aadhaar?"*, and *"What is U-GOV?"* failed intent matching or skipped internal U-GOV knowledge even when authoritative guidance existed locally.
  - *Alternatives Considered*: Keeping strict regex isolation. Rejected because innocent phrasing variations bypassed catalogue and FAQ grounding completely.

- **Decision 2: Verified Local Knowledge Fallback Instead of Dead-End Unavailable Errors**
  - *Chosen Approach*: When Gemini encounters authentication, quota, timeout, or upstream errors, resolve relevant entries from U-SERVICES, FAQ knowledge, and the statutory glossary, return HTTP 200 with full metadata (`fallbackAttempted`, `offlineFallback: true`), and label the source explicitly as **Verified Local Knowledge (Offline)**. If no local match exists, surface a clear guidance response plus suggested U-GOV queries.
  - *Why*: Citizens still receive helpful, accurate U-GOV guidance during upstream outages without ever falsely attributing static content to `"Google Gemini"`.
  - *Alternatives Considered*: Returning raw error strings for every Gemini failure. Rejected per user clarification as brittle and unhelpful for core citizen queries.

- **Decision 3: Truthful Health Telemetry & Non-Secret Request Diagnostics**
  - *Chosen Approach*: Support both lightweight readiness checks and an optional live connectivity/generation probe (`?probe=live`), while recording rolling runtime outcome telemetry (last success/failure timestamp and category) and per-request diagnostic fields (`model`, `fallbackAttempted`, `latencyMs`, `correlationId`) without exposing keys or sensitive user input.
  - *Why*: Eliminates the false confidence of `"HEALTHY / CONFIGURED_NOT_PROBED"` hiding broken models or expired credentials.
  - *Alternatives Considered*: Probing Gemini unconditionally on every modal open. Rejected to avoid unnecessary quota burn and cold-start delay unless explicitly requested or stale.

- **Decision 4: Stateful Retry Tracking in `AuthView`**
  - *Chosen Approach*: Track the last attempted authentication action (`login`, `register`, or `google`) so clicking **Retry** inside the inline status banner immediately re-runs the failed request with descriptive stage feedback.
  - *Why*: Recovers cleanly from transient gateway/network hiccups without forcing the citizen to re-type credentials or reload the page.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                           CITIZEN BROWSER CLIENT                           │
│                                                                            │
│  ┌──────────────────────────────┐    ┌──────────────────────────────────┐  │
│  │          AuthView            │    │           GBotModal              │  │
│  │ • Multi-stage status text    │    │ • Health bar (live vs offline)   │  │
│  │ • Inline alert + Retry action│    │ • Per-message source attribution │  │
│  └──────────────┬───────────────┘    │ • "Retry with Live AI" control   │  │
│                 │                    └─────────────────┬────────────────┘  │
└─────────────────┼──────────────────────────────────────┼───────────────────┘
                  │ POST /api/v1/auth/*                  │ GET /api/v1/ai/health
                  ▼                                      │ POST /api/v1/ai/chat
┌────────────────────────────────────────────────────────┼───────────────────┐
│                         EXPRESS API GATEWAY            ▼                   │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          AI Route & Diagnostics                      │  │
│  │ • Assigns correlationId & records latencyMs / outcome telemetry      │  │
│  │ • Optional live probe (?probe=live) verifying generation health      │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
│                                     ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     Intent Router & Grounding Layer                  │  │
│  │ • Private Citizen Workflow ──► Deterministic U-GOV Tool Provider     │  │
│  │ • Service / Navigation / General ──► Catalogue + FAQ + Glossary      │  │
│  └──────────────────────────────────┬───────────────────────────────────┘  │
│                                     ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Gemini Provider + Fallback Chain                  │  │
│  │  1. Try gemini-4-hydrogen (ThinkingLevel.LOW, 25s timeout)           │  │
│  │  2. On retryable error ─► Fallback to gemini-3.1-flash-lite          │  │
│  │  3. On upstream unavailable ─► Verified Local Knowledge (Offline)    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **AI Response Contract**: Extends chat responses with non-secret operational metadata (`model`, `fallbackAttempted`, `offlineFallback`, `latencyMs`, `correlationId`) and strictly separates `"Google Gemini"` attribution from `"U-GOV Verified Local Knowledge (Offline — Live Gemini unavailable)"`.
  - **AI Health Telemetry**: Tracks configuration state, active candidate model order (`gemini-4-hydrogen`, `gemini-3.1-flash-lite`), last runtime outcome (`responding` / `degraded` / `unavailable`), and optional live probe result.
  - **AuthView Recovery State**: Tracks `authStage` (`idle`, `validating`, `establishing_session`, `loading_workspace`), `lastAttempt` descriptor, and actionable error state paired with `GovContext` auth methods.
- **Interactive Component & State Mapping**:
  - **`AuthView` Inline Banner & Retry**: Submitting login, registration, or Google token verification updates `lastAttempt` and advances descriptive loading copy; errors display the inline alert banner with an active **Retry** button invoking `retryLastAttempt()` and a dismiss trigger clearing stale notices on tab/input change.
  - **`GBotModal` Message & Health Lifecycle**: Opening the modal calls `GET /api/v1/ai/health`; sending a query appends the optimistic user message, invokes `POST /api/v1/ai/chat`, updates `aiRequestStatus` truthfully based on `offlineFallback` / `source`, renders structured citations + correlation reference, and provides a working **Retry with Live AI** button when an offline fallback occurred.
- **Key Sequences & Verification Scope**:
  1. **Knowledge & Intent Consistency**: Ensure statutory/civic terms (`Aadhaar`, `Ration Card / NFSA`, `SIH / Smart India Hackathon`, `U-GOV`, `DigiLocker`, `PM-KISAN`, `PAN`) map cleanly in FAQ/glossary/catalogue grounding and respond accurately across `en`, `hi`, `mr`, and `kn`.
  2. **Verification Matrix Before Handover Report**:
     - Run automated unit/integration test suite covering primary model, model fallback, offline local knowledge fallback, timeout, quota/auth errors, and multi-language queries.
     - Execute compilation, ESLint/type check, production bundle build, dependency security audit (`npm audit`), and full Playwright end-to-end verification of `AuthView` (loading, inline error retry, login), Bharat G-Bot (all reproduction prompts + languages), and core U-GOV journeys (`U-DOCS`, `U-SERVICES`, `U-APPLICATIONS`, `Web Hub`, `Profile`, `Admin`).
     - Compile and deliver the complete 13-section **Implementation Audit & Handover Report** strictly reporting verified evidence and marking any unverified items explicitly as `NOT VERIFIED`, then halt for external review.
