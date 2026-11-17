# U-GOV — Project Context

Updated: 2026-11-17  
Active development line: `u_gov_v10`  
Repository: https://github.com/omtejas/u_gov

## Product

U-GOV (Unified Governance & Citizen Services Platform) is a citizen-first prototype for discovering public services, understanding requirements, preparing documents and tracking application workflows across fragmented government portals.

**Disclosure:** U-GOV is an independent prototype, not an official government portal or live government system. Catalogue entries and integration adapters may be simulated. Official eligibility, fees, deadlines and application status must be confirmed with the issuing authority.

## Core modules

- U-IDENTITY — account authentication, sessions and role-based access.
- U-DOCS — private citizen document vault and consent-aware access.
- U-SERVICES — public service catalogue and requirement readiness.
- U-APPLICATIONS / U-TRACK — application lifecycle and status.
- U-AI — Bharat G-Bot, with controlled tools and optional hosted model/web providers.
- U-INTEGRATIONS — bounded adapters; sandbox adapters are not live government integrations.
- U-AUDIT — security and accountability events.

## Current technical foundation

- Frontend: React 19, TypeScript, Vite, Tailwind CSS.
- Backend: Node.js, Express, TypeScript.
- Runtime persistence: currently a JSON-file metadata store; PostgreSQL schema/migration work is not yet wired into runtime.
- Binary files: storage-driver abstraction with local and S3-compatible implementations; live private bucket configuration and durable upload/download are not yet verified.
- AI: provider abstraction with Google Gemini, OpenAI-compatible and deterministic mock provider paths; controlled U-GOV tool gateway.
- Hosting: Render production service at https://ugov.onrender.com, connected to `main`; production deployment currently lags latest GitHub main.
- CI: GitHub Actions runs TypeScript type-check, production build and test suite. Netlify preview checks also exist and may fail independently.

## Engineering principles

This release follows the OMTEJAS Project Engineering Playbook v1.0:

1. Inspect the current code before changing it.
2. Build the smallest complete vertical slice.
3. Keep requirements and acceptance criteria testable.
4. Preserve the working architecture; avoid rewrites without evidence.
5. Never present mock or sandbox behavior as real government functionality.
6. Enforce authorization in the backend, not through AI prompts.
7. Keep secrets out of source control and logs.
8. Test every meaningful change and verify deployed behavior separately.
9. Keep interfaces concise, accessible, responsive and action-oriented.
10. Maintain this document set as the project source of truth.

## Version boundaries

- `main` is the production source branch. Do not merge or deploy V10 without explicit release approval.
- `u_gov_v9_stitch_integration` remains a separate V9 line; do not merge it into V10 wholesale.
- `u_gov_v10` is the current V10 development branch, created from main commit `23ff2a9c7e8a6ecda9b795f83f80c662f44d7b3a`.
- PR #13 is included in the main baseline, but its verification workflow failed. V10 must correct and re-verify that regression before feature expansion.

## Product design direction

Use the Stitch design assets as design references, not as production HTML to paste into React. Rebuild approved patterns with the existing component system and shared tokens.

**UI rule:** Less text, more impact. Strong hierarchy, purposeful components, clear actions, meaningful feedback, no decorative/inert controls.
