# Security Specification — Mi Presupuesto Mensual

## 1. Data Invariants
1. **Strict Ownership Isolation:** A user (`request.auth.uid`) may only read or write documents under `/users/{userId}`, `/users/{userId}/months/{monthId}`, and `/users/{userId}/movements/{movementId}` when `request.auth.uid == userId` and the provider is non-anonymous.
2. **No Global User Enumeration:** `list` on `/users` is unconditionally denied (`if false`).
3. **Master Gate on Subcollections:** Creating, updating, or deleting any document in `months` or `movements` requires the parent `/users/{userId}` document to exist (`exists(...)`).
4. **Immutable Ownership & Timestamps:** `uid`, `id`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
5. **Strict Key & Type Allowlists:** Every write enforces `hasAll` + `hasOnly` and strict `.size()` / numeric bounds so shadow fields (`isAdmin`, `role`, etc.) and oversized strings are rejected.
6. **Query Enforcement:** `allow list` on `months` and `movements` evaluates `resource.data.uid == request.auth.uid` directly without any `get()` or `exists()` calls.

## 2. The "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated read:** `GET /users/userA` with `auth = null`.
2. **Cross-user profile read:** `GET /users/userA` signed in as `userB`.
3. **Global user listing:** `LIST /users` signed in as `userA`.
4. **Identity spoofing on profile create:** `CREATE /users/userA` signed in as `userA` with `uid: "userB"`.
5. **Shadow privilege escalation field:** `CREATE /users/userA` with extra field `isAdmin: true`.
6. **Client-forged timestamp on create:** `CREATE /users/userA` with `createdAt: Timestamp(2020-01-01)`.
7. **Orphaned subcollection write (Master Gate violation):** `CREATE /users/userA/months/2026-11` when `/users/userA` does not exist.
8. **Cross-user movement list without owner filter:** `LIST /users/userA/movements` signed in as `userB`.
9. **Path ID poisoning:** `CREATE /users/userA/movements/bad$id!with/invalid` (fails `isValidId`).
10. **Negative or zero movement amount:** `CREATE /users/userA/movements/mov1` with `amount: -5000`.
11. **Oversized concept string (Denial-of-Wallet guard):** `CREATE /users/userA/movements/mov1` with `concept` > 140 chars.
12. **Immutable field mutation on update:** `UPDATE /users/userA/months/2026-11` modifying `createdAt` or `uid`.
