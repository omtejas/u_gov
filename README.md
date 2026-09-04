# U-GOV — Unified Governance & Citizen Services Platform

> **SIH Problem Statement SIH26129**: System integration and interoperability among government digital platforms, resulting in fragmented service delivery.  
> **Organization**: Government of Maharashtra | **Theme**: Smart Automation | **Team**: PROTECH SOCIETY (Team ID: SIH2026-190)

---

## 🏛️ Platform Overview

**U-GOV** is a sovereign Digital Public Infrastructure (DPI) platform designed to unify fragmented government citizen services across Central and State ministries into a seamless, citizen-centric, and privacy-preserving journey.

> **Important Disclosure**:  
> U-GOV currently demonstrates a secure sandbox/prototype integration architecture. Live government integrations require official APIs, authorization, credentials, contracts, statutory security reviews, and administrative deployment approval.

---

## 📐 Platform Architecture

```text
                         ┌───────────────────────┐
                         │   U-GOV Citizen UI    │
                         └───────────┬───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ↓                      ↓                      ↓
        U-IDENTITY                 U-AI                U-SERVICES
    (Sessions, RBAC)       (Grounded Assistant)   (Service Catalogue)
              │                      │                      │
              └──────────────┬───────┴──────────────┬───────┘
                             ↓                      ↓
                          U-DOCS              U-APPLICATIONS
                     (Sovereign Vault)      (Lifecycle Engine)
                             │                      │
                             ↓                      ↓
                         U-CONSENT            U-INTEGRATIONS
                    (Purpose-Bound Token)  (Reliability & SSRF Gateway)
                                                    │
                                            Integration Registry
                                                    │
                                            Sandbox Adapters
                                                    │
                                            Normalized Responses
                                                    │
                                                    ↓
                                                 U-AUDIT
                                                    │
                                      SHA-256 Hash-Chained
                                      Append-Only Audit Ledger
```

---

## 🛡️ Core Architectural Pillars

### 1. U-IDENTITY — Citizen Identity & Authentication
- **Password Security**: Scrypt hashing with unique cryptographically random salts.
- **Session Architecture**: Stateful server-side sessions with 256-bit opaque tokens, hashed via SHA-256 in storage.
- **Cookie Security**: `HttpOnly`, `SameSite=Lax`, and `Secure` cookies in production.
- **Access Control**: Role-Based (RBAC) and Permission-Based (PBAC) authorization middleware.
- **Brute-Force & Rate Limiting**: Sliding-window IP rate limiters on sensitive auth and mutation routes.
- **CSRF Protection**: Strict `Origin` and `Host` validation for state-changing browser requests.

### 2. U-AUDIT — Tamper-Evident Accountability
- **Terminology**: **SHA-256 Hash-Chained Append-Only Audit Ledger** (tamper-evident cryptographic chain).
- **Integrity**: Every critical platform event (identity, documents, consent, applications, integrations, AI queries) is cryptographically linked to the previous event's hash (`prevHash`).
- **Chain Verification**: Self-verifying cryptographic verification endpoint (`GET /api/v1/auth/audit/verify`) ensures no records have been pruned, modified, or re-ordered.

### 3. U-DOCS — Sovereign Citizen Document Vault
- **Storage Driver Abstraction**: Private vault storage driver with 0o700 directories and 0o600 files.
- **Zero Public Exposure**: Document files are never exposed via static web servers or public URLs.
- **Cryptographic Integrity**: SHA-256 checksums computed on ingestion and verified on every retrieval.
- **Strict Ownership**: Citizens can only view, attach, or delete documents belonging to their authenticated account.

### 4. U-CONSENT — Citizen-Controlled Data Sharing
- **Explicit Consent**: Requires active citizen authorization specifying statutory recipient, explicit purpose, and strict validity period.
- **Granular Document Selection**: Never automatically shares the entire vault; only citizen-selected documents are bound to the consent token.
- **Revocation**: Citizens can revoke active consents at any time, immediately invalidating downstream access.

### 5. U-SERVICES — Unified Public Service Catalogue & Requirement Engine
- **Centralized Catalogue**: Normalized schemes and services across Central & State ministries (e.g. NSP, Sarathi Driving Licence, Domicile Certificate, PM-KISAN, Ayushman Bharat).
- **Dynamic Requirement Evaluator**: Automatically matches service prerequisite document types against the citizen's vault, computing readiness percentage and identifying missing credentials.

### 6. U-APPLICATIONS — Application Lifecycle Engine
- **Deterministic State Machine**:
  `DRAFT` → `DOCUMENTS_REQUIRED` → `READY` → `CONSENT_REQUIRED` → `CONSENT_GRANTED` → `SUBMITTED` → `PROCESSING` → `APPROVED` / `REJECTED` / `ACTION_REQUIRED` / `CANCELLED`.
- **Integrity Lock**: Once submitted, attached documents and consent records are locked from tampering or detachment.
- **Cancellation**: Fully authenticated, citizen-scoped, state-aware, and audited cancellation flow.

### 7. U-INTEGRATIONS — Secure Integration Adapter Architecture & Sandbox Gateway
- **Zero Real API Calls**: Connects only to approved internal mock endpoints (`mock://bharat-bus.internal/*`).
- **SSRF Defense**: Outbound destination boundary rejects arbitrary external URLs, loopback (`127.0.0.1`), private RFC1918 subnets, cloud metadata (`169.254.169.254`), and non-mock protocols (`file://`, `gopher://`).
- **Reliability Engine**:
  - **Idempotency**: Deterministic keys (`SHA-256(appId + serviceCode + userId)`) prevent accidental duplicate submissions.
  - **Bounded Timeouts**: Configurable execution promises (default 5000ms).
  - **Bounded Retries**: Circuit-breaking exponential backoff retrying transient faults only (`TIMEOUT`, `UNAVAILABLE`, `RATE_LIMITED`); non-retryable validation or auth errors fail immediately.
- **Correlation IDs**: `UGOV-INT-xxxxxxxxxxxx` propagated across applications, provider adapters, and audit records.

### 8. U-AI — Sovereign Citizen Assistance & Intelligence Layer
- **Provider Abstraction**: Vendor-agnostic `AIProvider` interface with `MockAIProvider` (deterministic, zero external API keys) and `GeminiProvider` (bounded timeouts, zero secret leakage).
- **Controlled Tool Gateway**:
  - `searchServices`: Discovers public services without unrestricted database access.
  - `getServiceDetails`: Retrieves statutory SLAs, fees, and eligibility criteria.
  - `checkRequirements`: Returns statutory document checklists.
  - `getCitizenApplicationStatus`: Citizen-scoped application status lookup with strict IDOR protection.
  - `getCitizenDocumentReadiness`: Evaluates vault readiness without exposing raw filesystem paths or document content.
- **AI Safety & Honesty**: Clearly displays `"AI-generated guidance. Verify important information before submission."` Never performs autonomous submissions or consent authorizations.

---

## 🔒 Security Model & Defenses

| Security Layer | Implemented Defense |
|---|---|
| **Authentication** | Scrypt password hashing, random salts, 256-bit opaque session tokens, HttpOnly/SameSite/Secure cookies. |
| **Authorization** | Server-side RBAC and PBAC enforced on every protected route. |
| **IDOR Protection** | Strict resource ownership checks on documents, consents, applications, integrations, audit events, and AI queries. |
| **CSRF Defense** | Origin and Host verification on mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`). |
| **SSRF Defense** | Outbound boundary allowlist (`mock://bharat-bus.internal/*`), blocking localhost, private subnets, and cloud metadata. |
| **Production DB Guard** | Enforces `DATABASE_URL` presence in production; prevents silent fallback to JSON storage. |
| **Secret Protection** | Zero secrets, API keys, session cookies, or raw authorization headers exposed in logs, audit records, or API responses. |
| **Security Headers** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and `Content-Security-Policy`. |

---

## 🧪 Test Suite & Quality Verification

```bash
# Run all automated test suites across all platform layers
npm test

# Run TypeScript compilation and static analysis
npm run lint

# Build production bundle (Vite + Node server bundle)
npm run build
```

### Verified Test Results (337 Tests Passing):
- `auth.test.ts`: **25 / 25 Passed** (Identity, Sessions, CSRF, Rate Limiting, Audit)
- `api.test.ts`: **20 / 20 Passed** (Platform Endpoints, Fallbacks, Public Health)
- `documents.test.ts`: **32 / 32 Passed** (U-DOCS Private Vault, SHA-256 Checksums, Ownership)
- `services.test.ts`: **36 / 36 Passed** (U-SERVICES Catalogue, Requirement Engine, Dynamic Readiness)
- `applications.test.ts`: **67 / 67 Passed** (U-APPLICATIONS State Machine, Locks, Disclosures)
- `applications_ui.test.ts`: **32 / 32 Passed** (Citizen End-to-End Application UI Flows)
- `integrations.test.ts`: **55 / 55 Passed** (U-INTEGRATIONS Registry, Idempotency, SSRF, Bounded Retries)
- `ai.test.ts`: **70 / 70 Passed** (U-AI Provider Abstraction, Tool Gateway, IDOR Defense, Audit)
- **Total: 337 / 337 Automated Tests Passing (100% Pass Rate)**

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# The platform runs on http://localhost:3000
```

---

## 🌐 Deployment Architecture

U-GOV supports a dual-target deployment model:

### 1. Unified Full-Stack Node.js Deployment (Render, Railway, VPS, Docker)
- **Frontend & Backend in One**: The Express server in `server.ts` statically serves the compiled Vite frontend from `dist/` and mounts all secure `/api/v1/*` routes.
- **Build**: `npm run build` (builds both Vite client and `dist/server.js`).
- **Run**: `npm start` (`node dist/server.js`).
- **Database**: PostgreSQL via `DATABASE_URL` (with automated migrations / PostgreSQL driver).

### 2. Decoupled Frontend (Vercel) + API Server
- **Frontend SPA (Vercel)**:
  - Configured via `vercel.json` (`buildCommand: "vite build"`, `outputDirectory: "dist"`, SPA fallback rewrites).
  - Environment variables: `VITE_API_URL` (optional, pointing to the external Node.js backend if decoupled).
- **Backend API**:
  - Deploy `server.ts` to any long-running Node.js container or PaaS (Render, Railway, Fly.io, or AWS ECS).
  - Securely inject `DATABASE_URL`, `SESSION_SECRET`, and `GEMINI_API_KEY` only into the backend environment.

