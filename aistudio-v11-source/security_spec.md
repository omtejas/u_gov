# U-GOV Security Specification & Firestore Rules Test Plan

## 1. Core Data Invariants
1. **Default Deny Catch-All**: Unmatched paths (`/{document=**}`) deny all reads and writes.
2. **Verified Identity Mandate**: All non-public writes and all private reads require `request.auth != null && request.auth.token.email_verified == true`.
3. **Strict Path ID Poisoning Guard**: Single-document reads/writes apply `isValidId()` (`size() <= 128` matching `^[a-zA-Z0-9_\-]+$`).
4. **PII Split Isolation**: `/users/{userId}` holds only non-PII display preferences; `/users/{userId}/private/{docId}` holds PII and is readable/writable strictly by the owner (`request.auth.uid == userId`) or verified Admin (`isAdmin()`).
5. **Master Gate Relational Sync**: `/documents/{documentId}/consents/{consentId}` strictly validates that the parent `/documents/{documentId}` exists and `parent.ownerId == request.auth.uid`.
6. **Immutable Ownership & Temporal Integrity**: `ownerId`/`uid`, `createdAt`, and `grantedAt` cannot be modified after creation; `createdAt` and `updatedAt` must equal `request.time`.
7. **Terminal State Locking**: Once an `ApplicationRecord` reaches `APPROVED`, `REJECTED`, or `CANCELLED`, or a `DocumentConsent` reaches `REVOKED`/`EXPIRED`, citizen updates are rejected (Admin override only).
8. **Query Enforcer (No Client Delegation)**: Every `allow list` on private collections enforces `resource.data.ownerId == request.auth.uid` (or `resource.data.uid == request.auth.uid`) with zero `get()`/`exists()` inside `allow list`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Unverified Email Write**: Signed-in user with `email_verified: false` creating `/documents/doc1`.
2. **Identity Spoofing on Create**: User `alice` creating `/documents/doc2` with `ownerId: "bob"`.
3. **Ghost / Shadow Field Injection**: Creating `/documents/doc3` with extra unexpected key `isVerifiedByGov: true`.
4. **Path ID Poisoning**: Creating `/documents/invalid$id*overflow...` exceeding pattern or 128 chars.
5. **Type & Size Poisoning**: Updating `/applications/app1` with oversized `status` string (>2KB) or wrong field type.
6. **Admin Spoof via Unverified Token Claim**: Attacker using custom token email `tagtheindian0@gmail.com` with `email_verified: false` writing to `/services/srv1`.
7. **Self-Assigned Admin Escalation**: Citizen attempting to create `/admins/{uid}` directly.
8. **Blanket PII Read Cross-User**: User `alice` reading `/users/bob/private/info`.
9. **Terminal State Violation**: Citizen mutating `/applications/app_approved` after `status == "APPROVED"`.
10. **Client-Forged Timestamp**: Creating `/grievances/gr1` with backdated client `createdAt` instead of `request.time`.
11. **Orphaned Subcollection Consent**: Creating `/documents/nonexistent/consents/c1` without existing parent document owned by caller.
12. **Blanket List Scraping**: Unscoped `list` query on `/documents` or `/applications` without `ownerId == request.auth.uid`.
