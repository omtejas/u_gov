# U-GOV V10 — Engineering Decisions

Updated: 2026-11-17

## D-001 — Preserve the modular monolith

**Decision:** Continue with the existing React/Vite frontend and Express backend.  
**Reason:** The current codebase already contains useful identity, service, application, document, audit, integration and AI modules. A rewrite would add risk without solving the verified release blockers.  
**Review when:** Independent scaling, deployment or team ownership provides measurable benefit.

## D-002 — V10 is isolated from production

**Decision:** Develop on `u_gov_v10`, based on the latest main commit.  
**Reason:** Keep the live Render service and production main branch stable.  
**Rule:** No merge, Render environment mutation or production deployment without explicit user approval.

## D-003 — V9 remains separate

**Decision:** Do not merge the existing V9 branch into V10. Reuse selected designs or requirements only after inspecting and validating them.  
**Reason:** Avoid importing unverified or conflicting work wholesale.

## D-004 — Evidence before readiness claims

**Decision:** Distinguish configured, reachable, responding and degraded states.  
**Reason:** A configured key or health endpoint is not proof that a provider completed a real request.  
**Acceptance:** A hosted AI provider is called “responding” only after a successful real request; health checks must not claim a live model test unless one was performed.

## D-005 — AI never authorizes private access

**Decision:** Backend authentication and authorization remain authoritative. G-Bot may request approved tools, but every private tool validates the current user and ownership independently.  
**Reason:** Prompt instructions cannot be used as an access-control boundary.

## D-006 — Keep sandbox integrations explicit

**Decision:** Mock adapters, sample catalogue entries and simulated application outcomes must be labeled as prototype/sandbox behavior.  
**Reason:** Avoid implying official government connectivity or statutory outcomes.

## D-007 — Durable data before advanced document features

**Decision:** Verify metadata persistence, private object storage, ownership, deletion, backups and recovery before claiming U-DOCS is production-ready or adding sensitive document intelligence.  
**Reason:** AI analysis is not useful if source documents are not securely and durably managed.

## D-008 — Stitch is a design source, not production code

**Decision:** Extract tokens, layout patterns and component behavior from Stitch references; implement them using the existing React architecture.  
**Reason:** Avoid pasting generated standalone HTML into the application or duplicating design systems.

## D-009 — Vertical slices and test gates

**Decision:** Every workstream is implemented as small end-to-end slices with acceptance criteria, tests and evidence.  
**Reason:** Catch integration failures early and reduce unverified AI-generated changes.

## D-010 — Minimal, high-impact UI

**Decision:** Reduce unnecessary copy and visual clutter. Every control must perform a real action and expose loading, empty, success and error states.  
**Reason:** Improve usability without expanding interface complexity.
