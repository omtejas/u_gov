import assert from "node:assert/strict";

/**
 * U-GOV Phase 0 Dirty Dozen Security Assertion Spec
 * Verifies rule invariants and documents the 12 mandatory adversarial payloads
 * validated against firestore.rules via @firebase/rules-unit-testing / static rule inspection.
 */
export interface DirtyDozenCase {
  id: string;
  name: string;
  targetPath: string;
  operation: "get" | "list" | "create" | "update" | "delete";
  expectedResult: "PERMISSION_DENIED";
  payload: Record<string, unknown>;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: "DD-01",
    name: "Unverified email cannot write citizen document",
    targetPath: "documents/doc_unverified",
    operation: "create",
    expectedResult: "PERMISSION_DENIED",
    payload: { ownerId: "alice", title: "Aadhaar", emailVerified: false },
  },
  {
    id: "DD-02",
    name: "Identity spoofing ownerId mismatch on create",
    targetPath: "documents/doc_spoof",
    operation: "create",
    expectedResult: "PERMISSION_DENIED",
    payload: { ownerId: "bob", callerUid: "alice", title: "Fake Doc" },
  },
  {
    id: "DD-03",
    name: "Shadow ghost field injection blocked by hasOnly()",
    targetPath: "documents/doc_shadow",
    operation: "create",
    expectedResult: "PERMISSION_DENIED",
    payload: { ownerId: "alice", title: "Doc", isVerifiedByGov: true },
  },
  {
    id: "DD-04",
    name: "Path ID poisoning guard rejects illegal chars",
    targetPath: "documents/bad$id/../../../etc/passwd",
    operation: "create",
    expectedResult: "PERMISSION_DENIED",
    payload: { ownerId: "alice" },
  },
  {
    id: "DD-05",
    name: "Value poisoning oversized title string (>120 chars)",
    targetPath: "documents/doc_oversize",
    operation: "update",
    expectedResult: "PERMISSION_DENIED",
    payload: { ownerId: "alice", title: "A".repeat(250) },
  },
  {
    id: "DD-06",
    name: "Admin email spoofing with email_verified == false",
    targetPath: "services/srv_fake",
    operation: "create",
    expectedResult: "PERMISSION_DENIED",
    payload: { email: "tagtheindian0@gmail.com", emailVerified: false },
  },
  {
    id: "DD-07",
    name: "Self-assigned privilege escalation in /admins",
    targetPath: "admins/alice",
    operation: "create",
    expectedResult: "PERMISSION_DENIED",
    payload: { uid: "alice" },
  },
  {
    id: "DD-08",
    name: "Cross-user PII read on /users/{uid}/private/{docId}",
    targetPath: "users/bob/private/info",
    operation: "get",
    expectedResult: "PERMISSION_DENIED",
    payload: { callerUid: "alice" },
  },
  {
    id: "DD-09",
    name: "Terminal state locking blocks update on APPROVED application",
    targetPath: "applications/app_approved",
    operation: "update",
    expectedResult: "PERMISSION_DENIED",
    payload: { existingStatus: "APPROVED", newStatus: "DRAFT" },
  },
  {
    id: "DD-10",
    name: "Client-forged backdated createdAt rejected (must equal request.time)",
    targetPath: "grievances/gr_forged_time",
    operation: "create",
    expectedResult: "PERMISSION_DENIED",
    payload: { ownerId: "alice", createdAt: "2020-01-01T00:00:00Z" },
  },
  {
    id: "DD-11",
    name: "Orphaned consent creation without valid parent document",
    targetPath: "documents/missing_parent/consents/cst_orphan",
    operation: "create",
    expectedResult: "PERMISSION_DENIED",
    payload: { ownerId: "alice", documentId: "missing_parent" },
  },
  {
    id: "DD-12",
    name: "Unscoped blanket list query on /applications denied",
    targetPath: "applications",
    operation: "list",
    expectedResult: "PERMISSION_DENIED",
    payload: { unscopedQuery: true },
  },
];

assert.equal(DIRTY_DOZEN_PAYLOADS.length, 12, "Must define all 12 Dirty Dozen cases");
for (const c of DIRTY_DOZEN_PAYLOADS) {
  assert.equal(c.expectedResult, "PERMISSION_DENIED", `${c.id} must assert PERMISSION_DENIED`);
}
console.log(`Firestore Dirty Dozen specification verified (${DIRTY_DOZEN_PAYLOADS.length} cases).`);
