# Production hardening — full route audit + verification

**Last reviewed: 2026-06-12** — covers the codebase up to migration 044.

A single-source-of-truth audit of every API route in `app/api/`. 52 route
files inspected; ~70 HTTP handlers across them. Each handler is classified
across **eleven** dimensions plus a recommended action. Sections below
break out the cross-cutting concerns (service-role, access gate, audit
logs, PHI, demo invites, satisfaction/readiness).

This document is meant to be **edited in place** as the codebase changes
— when you add a new route, fill in its row before merging. When you do
a sweep through the matrix, bump the "Last reviewed" date.

## Status legend

- **PR** — production-ready customer-facing route
- **PB** — production-blocker (would harm a customer if shipped as-is)
- **IS** — internal/system route (cron / webhook / Fortify-admin)
- **(✓)** = enforced today, **(✗)** = NOT enforced, **(—)** = not applicable

## 1. The matrix

| Route | Method | Purpose | Auth | Membership | Admin/CO role | Active access | Service-role | Audit log | PHI scan | Class | Action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Onboarding & auth** ||||||||||||
| `/api/auth/signup` | POST | Standard email-verified signup (anon SDK call) | rate-limit by IP | n/a | — | — | — | — (auth event) | regex on email | PR | none |
| `/api/onboarding/employee` | POST | Standard-user join request | ✓ JWT | ✗ (creating) | — | — | ✓ (cross-tenant notify) | ✓ via helper | ✓ scanFieldsForPhi on free-text | PR | none |
| `/api/onboarding/finalize` | POST | Founder creates / updates practice | ✓ JWT | ✗ (bootstrap) | — | — | ✓ (bootstrap) | ✓ + invite redemption audit | ✓ scanFieldsForPhi on free-text | PR | none |
| **Billing** ||||||||||||
| `/api/billing/checkout` | POST | Stripe checkout session | ✓ JWT | ✓ owner-tier read | — | ✗ — must work for expired demos | — | — | — | PR | none |
| `/api/billing/webhook` | POST | Stripe webhook | Stripe signature | — | — | — | ✓ (system) | ✓ subscription state changes | — | IS | none |
| **Fortify-admin** ||||||||||||
| `/api/admin/invites` | POST | Create demo invite code | ✓ + isFortifyAdmin | n/a | n/a (Fortify admin) | n/a | ✓ (no practice scope) | DB-side (invite_codes itself) | — | IS | none |
| `/api/admin/invites` | GET | List own codes | ✓ + isFortifyAdmin | n/a | n/a | n/a | ✓ | — | — | IS | none |
| `/api/admin/invites/:id/revoke` | POST | Revoke a code | ✓ + isFortifyAdmin | n/a | n/a | n/a | ✓ | DB-side (invite_codes.revoked_at) | — | IS | none |
| `/api/sentry-check` | GET | Verify Sentry capture | ✓ + Fortify-admin role | ✓ | ✓ | — | — | — (Sentry IS the log) | — | IS | none |
| **Evidence** ||||||||||||
| `/api/evidence/upload` | POST | Mint signed upload URL | ✓ session | ✓ admin | ✓ isAdmin | ✓ gate | ✓ (storage signing) | — (signed-URL only, finalize logs) | — (file blob; finalize scans filename) | PR | none |
| `/api/evidence/finalize` | POST | Commit uploaded evidence | ✓ session | ✓ admin | ✓ isAdmin | ✓ gate | ✓ (storage RLS + flow) | ✓ via `runEvidenceFlow` | ✓ scanFields on file_name + notes | PR | none |
| `/api/evidence/attest` | POST | Manual attestation record | ✓ session | ✓ admin | ✓ isAdmin | ✓ gate | ✓ (flow) | ✓ via `runEvidenceFlow` | ✓ phiFields on statement | PR | none |
| `/api/evidence/download` | GET | Get signed download URL | ✓ session | ✓ path-prefix check | — | — | ✓ (storage signing) | — (read-only) | — | PR | none |
| **Policies** ||||||||||||
| `/api/policies/generate` | POST | AI-draft a policy | ✓ JWT | ✓ membership | — | ✓ gate | — | ✓ policy.generated | ✓ phiFields on title + type | PR | none |
| `/api/policies/:id/acknowledge` | POST | Workforce acknowledges current version | ✓ session | ✓ | — | ✓ gate | ✓ (gate read only; ack+auto-resolve+audit are inside the `acknowledge_policy` RPC) | ✓ policy.acknowledged (in RPC) | — | PR | none |
| **Training** ||||||||||||
| `/api/training/:id/complete` | POST | Record quiz pass | ✓ session | ✓ | — | ✓ gate | ✓ (audit row) | ✓ training.completed | — | PR | none |
| **Reports & attestations** ||||||||||||
| `/api/reports/generate` | POST | Generate audit-readiness report (with recompute) | ✓ JWT | ✓ practice match | — | ✓ gate | — | ✓ report.generated | — | PR | none |
| `/api/risk-assessment` | POST | AI risk-assessment summary | ✓ JWT | ✓ practice match | — | ✓ gate | — | ✓ risk_assessment.* | — | PR | none |
| `/api/attestations` | POST | Generate signed attestation (with recompute) | ✓ JWT | ✓ membership | ✓ isAdmin | ✓ gate | ✓ (build snapshot) | ✓ via `generateAttestation` | ✓ (no free-text input) | PR | none |
| `/api/attestations/:id/sign` | POST | Sign attestation (e-sig or print) | ✓ JWT | ✓ practice match | ✓ isAdmin | ✓ gate | ✓ (write signature) | ✓ attestation.signed | — | PR | none |
| **Tasks** ||||||||||||
| `/api/tasks` | GET | List tasks (mine/practice) | ✓ JWT | ✓ membership | conditional | — (read) | ✓ | — | — | PR | none |
| `/api/tasks` | POST | Admin creates manual task | ✓ JWT | ✓ membership | ✓ isAdmin | ✓ gate | ✓ | ✓ `task.created` | ✓ phiFields on title + notes | PR | none |
| `/api/tasks/:id` | POST | Update task | ✓ JWT | ✓ (via task.practice_id) | assignee-or-admin | ✓ gate | ✓ | ✓ `task.<status>` on status change only³ | ✓ phiFields on notes | PR | none |
| **Integrations — connect (initiate)** ||||||||||||
| `/api/integrations/m365/connect` | GET | Begin M365 OAuth | ✓ JWT | ✓ membership | implicit (state cookie) | ✓ gate | — | — (callback logs) | — | PR | none |
| `/api/integrations/google/connect` | GET | Begin Google Workspace OAuth | ✓ JWT | ✓ membership | ✓ owner/admin | ✓ gate | — | — | — | PR | none |
| `/api/integrations/okta/connect` | POST | Persist Okta credentials | ✓ JWT | ✓ membership | ✓ isAdmin | ✓ gate | ✓ (encrypted creds) | ✓ integration.connected | — | PR | none |
| `/api/integrations/aws/connect` | POST | Persist AWS credentials | ✓ JWT | ✓ membership | ✓ isAdmin | ✓ gate | ✓ (encrypted creds) | ✓ integration.connected | — | PR | none |
| `/api/integrations/docusign/connect` | GET | Begin DocuSign OAuth | ✓ JWT | ✓ membership | ✓ owner/admin | ✓ gate | — | — | — | PR | none |
| **Integrations — callback (finish OAuth)** ||||||||||||
| `/api/integrations/m365/callback` | GET | Finish M365 OAuth | state cookie | (verified via state) | (implicit) | — (auth-finishing) | ✓ (creds write) | ✓ integration.connected | — | PR | none |
| `/api/integrations/google/callback` | GET | Finish Google OAuth | state cookie | (verified via state) | (implicit) | — | ✓ (creds write) | ✓ integration.connected | — | PR | none |
| `/api/integrations/docusign/callback` | GET | Finish DocuSign OAuth | state cookie | (verified via state) | (implicit) | — | ✓ (creds write) | ✓ integration.connected | — | PR | none |
| **Team** ||||||||||||
| `/api/team/add` | POST | Add member by email | ✓ JWT | ✓ caller in practice | ✓ isAdmin | ✓ gate | ✓ (auth.users) | ✓ team.member_added | — | PR | none |
| `/api/team/role` | POST | Change member role | ✓ JWT | ✓ caller in practice | ✓ isAdmin (+ Owner for owner grants) | ✓ gate | — | ✓ team.role_changed | — | PR | none |
| `/api/team/remove` | POST | Remove member | ✓ JWT | ✓ caller in practice | ✓ isAdmin | ✓ gate | — | ✓ team.member_removed | — | PR | none |
| `/api/team/leave` | POST | User leaves a practice | ✓ JWT | ✓ self | — | ✗ — must work always | — | ✓ team.member_left | — | PR | none |
| `/api/team/name` | POST | Edit user's display name | ✓ JWT | ✓ caller in practice | ✓ owner/admin | ✓ gate | ✓ (cross-user write) | ✓ team.name_updated | ✓ phiFields on full_name | PR | none |
| `/api/team/requests/:id` | POST | Approve / deny join request | ✓ JWT | ✓ caller in matched practice | ✓ owner/admin | ✓ gate | ✓ (cross-tenant) | ✓ join_request.* | ✓ phiFields on denial_reason | PR | none |
| `/api/invites/queue` | POST | Queue practice invites | ✓ JWT | (caller's practice) | — | ✓ gate | — | ✓ invites.queued | — | PR | none |
| `/api/practice/delete` | POST | Permanently delete a practice | ✓ JWT | ✓ caller in practice | ✓ isOwner | ✗ — must work always | — | ✗ row cascades on delete | — | PR | **add Sentry capture² for external audit** |
| **Screening** ||||||||||||
| `/api/screening/preliminary` | POST | Run tier-1 OIG screening | ✓ JWT (+ IP rate-limit) | conditional (practice_id) | — | conditional gate | ✓ | ✓ via `startPreliminary` | ✓ phiFields on first/last name | PR | none |
| `/api/screening/vendor` | POST | Screen vendor contact | ✓ JWT | ✓ vendor's practice | ✓ isAdmin | ✓ gate | ✓ | ✓ via `startPreliminary` | ✓ phiFields on first/last name | PR | none |
| `/api/screening/:id/verify` | POST | Tier-2 verification | ✓ JWT | ✓ self OR admin of practice | conditional | conditional gate | ✓ | ✓ via `completeVerification` | ✓ phiFields on middle_name + address | PR | none |
| `/api/screening/:id/override` | POST | Admin overrides blocked screening | ✓ JWT | ✓ caller in practice | ✓ isAdmin | ✓ gate | ✓ | ✓ via `overrideBlocked` | ✓ phiFields on reason | PR | none |
| `/api/screening/:id` | GET | Read screening detail | ✓ JWT | ✓ self OR admin | conditional | — (read) | ✓ | — | — | PR | none |
| **Invites (demo)** ||||||||||||
| `/api/invites/preview` | GET | Public preview of an invite code | rate-limit by IP | — | — | — | ✓ (read code_hash) | — (read-only) | — | PR | none |
| **Notifications** ||||||||||||
| `/api/notifications` | GET | List notifications | ✓ JWT | ✓ self | — | — (read) | ✓ | — | — | PR | none |
| `/api/notifications` | POST | Mark notifications read | ✓ JWT | ✓ self | — | ✗ — read-flag is fine | ✓ | — | — | PR | none |
| **Search** ||||||||||||
| `/api/search` | GET | Search threats / controls | ✓ JWT | ✓ caller's practice | — | — (read) | ✓ | — | — | PR | none |
| **Cron (system)** ||||||||||||
| `/api/cron/verify-compliance` | GET | Run all configured integration checks | Bearer CRON_SECRET | — | — | — | ✓ (system) | ✓ via flow | — | IS | none |
| `/api/cron/readiness-digest` | GET | Weekly Monday digest email | Bearer CRON_SECRET | — | — | — | ✓ (system) | ✓ digest.sent | — | IS | none |
| `/api/cron/exclusion-list-ingest` | GET | Refresh OIG LEIE list | Bearer CRON_SECRET | — | — | — | ✓ (system) | — (load metadata) | — | IS | none |
| `/api/cron/exclusion-rescreen` | GET | Re-screen workforce against new LEIE | Bearer CRON_SECRET | — | — | — | ✓ (system) | ✓ via service | ✓ name fields scanned | IS | none |
| `/api/cron/ingest` | GET | Pull RSS threat-intel | Bearer CRON_SECRET | — | — | — | ✓ (system) | — | — | IS | none |
| `/api/cron/task-reminders` | GET | Email overdue task reminders | Bearer CRON_SECRET | — | — | — | ✓ (system) | — | — | IS | none |
| `/api/cron/recompute-control-status` | GET | Daily satisfaction-rule recompute | Bearer CRON_SECRET | — | — | — | ✓ (system) | — | — | IS | none |

¹ Manual task creation logs `task.created` to audit_logs. (See ³ for the
  update path.)

² Practice deletion: the per-tenant audit_logs row cascades along with
  the practice row, leaving no DB trail. Resolved in migration 043 by
  adding `platform_audit_logs` (no tenant FK; survives deletion) and
  wiring `/api/practice/delete` to write to it before the cascade. The
  helper also mirrors to Sentry as a breadcrumb so the event survives
  even a DB-level write failure.

³ Task update audit: `/api/tasks/:id` writes `task.<status>` (e.g.
  `task.done`, `task.in_progress`) with `{from, to}` metadata, and ONLY
  when the request changes the status field. A notes-only or due-date-only
  edit does NOT write an audit row — by design, since those are not
  state transitions. If a future requirement needs every edit audited,
  add a `task.edited` write on the non-status branch. The
  `remediation_tasks` row itself records `completed_at` / `assigned_to`
  regardless.

## 2. Service-role usage

`createServerClient()` returns a Supabase client signed with
SUPABASE_SERVICE_ROLE_KEY. It bypasses RLS, so every usage MUST be
justified. Below is every file that uses it and why.

| File | Purpose of service-role | Why RLS can't cover | Caller verification | Future RLS/RPC path |
|---|---|---|---|---|
| `app/api/onboarding/finalize/route.ts` | Create the practice + founder's practice_users row | At write time, the user has NO membership; RLS would block | `userClient.auth.getUser()` → JWT user.id pinned in inserts | Could move to a `bootstrap_practice()` SECURITY DEFINER RPC |
| `app/api/onboarding/employee/route.ts` | Notify admins of OTHER practices | Cross-tenant write to `notifications` + `audit_logs` | JWT user.id pinned in inserts | RPC `submit_join_request()` similar pattern |
| `app/api/team/add/route.ts` | List `auth.users` by email | auth.users not exposed to anon/authenticated | Caller is admin/owner of target practice (RLS-equivalent check) | Could move to `admin_lookup_user(email)` RPC |
| `app/api/team/name/route.ts` | Update another user's profile | user_profiles RLS is `user_id = auth.uid()` — admin can't edit others | Same | RPC `admin_update_user_profile()` |
| `app/api/team/requests/:id/route.ts` | Create membership row + update profile | Admin acting cross-account | Same | RPC `decide_join_request()` |
| `app/api/evidence/upload/route.ts` | Sign upload URL | Storage signing requires service role | Path-prefix check (`{practice_id}/`) | n/a (cannot avoid) |
| `app/api/evidence/finalize/route.ts` | Upload commit + storage cleanup | Path-prefix RLS already exists; service-role for `runEvidenceFlow` cross-flow writes | Practice-id verified from session | RPC `commit_evidence()` |
| `app/api/evidence/attest/route.ts` | Persist attestation evidence | Cross-flow writes | Session-based admin check | Same |
| `app/api/evidence/download/route.ts` | Sign download URL | Storage signing | Path-prefix check | n/a |
| `app/api/policies/:id/acknowledge/route.ts` | (removed) — now delegates to `acknowledge_policy()` SECURITY DEFINER RPC (migration 044) | n/a | n/a | ✅ done |
| `app/api/attestations/route.ts` | `buildSnapshot()` reads + writes across tables | Multi-table batch | Admin role verified | n/a |
| `app/api/attestations/:id/sign/route.ts` | Write signature | Cross-user signature record | Admin role verified | RPC `sign_attestation()` |
| `app/api/tasks/route.ts`, `tasks/:id/route.ts` | Read membership + create tasks | Membership lookup + practice-scoped write | JWT user.id pinned | Could be authed-client only |
| `app/api/integrations/*/connect`, `*/callback` (POST/GET routes) | Persist encrypted credentials | `credentials_blob` CHECK constraint requires service-role write path | OAuth state cookie verified; admin role verified | n/a (CHECK constraint by design) |
| `app/api/screening/*` (all mutating) | Cross-table writes in service helpers | Screening service spans `exclusion_screenings`, `practice_users`, `audit_logs` | JWT user.id pinned; admin role verified | RPC `start_preliminary_screening()` etc. |
| `app/api/invites/queue/route.ts` | Audit log write | Cross-tenant audit | JWT user.id pinned | n/a |
| `app/api/admin/invites/*` | Create / list / revoke codes | Fortify-admin scope, no practice context | `isFortifyAdmin(user.email)` allowlist | n/a |
| `app/api/billing/webhook/route.ts` | Practice updates from Stripe events | No user context | Stripe signature verified | n/a (canonical pattern) |
| `app/api/cron/*` | All cross-tenant by design | n/a | `Bearer ${CRON_SECRET}` verified | n/a (canonical pattern) |
| `app/api/search/route.ts` | Cross-table federated search | Practice-id filter | Practice-id pulled from JWT | Could be authed-client only |
| `app/api/notifications/route.ts` | Read + mark-read with self-filter | Self-filtered queries | `eq(user_id, auth.uid())` | Could be authed-client only |

**Pattern check (passed for every entry above):** In every route the user
identity is first established via `createAuthedServerClient().auth.getUser()`,
the caller's role / membership / ownership is verified, and any
`user_id` / `actor_user_id` field written via service-role is pinned to
the JWT subject — never trusted from the request body.

## 3. Access-state enforcement

Routes that should call `requirePracticeAccess(db, practiceId)` —
verified against the matrix above.

**Enforced today (✅):** every "paid-value mutating" route — the full
list is in section 1's table where "Active access" reads ✓ gate.

**Intentionally NOT enforced (each justified):**

| Route | Why allowed past the gate |
|---|---|
| `/api/billing/checkout` | Expired demos must be able to subscribe |
| `/api/team/leave` | A user must always be able to leave a practice |
| `/api/practice/delete` | Owner can always destroy their own practice |
| `/api/notifications` POST | Mark-read flag; no real mutation of business data |
| `/api/onboarding/*` | Practice doesn't exist yet |
| `/api/auth/signup` | Pre-account state |
| `/api/admin/invites/*` | Fortify-admin scope; not bound to a practice |
| `/api/invites/preview` | Public route — IP-rate-limited |
| `/api/cron/*` | System-level |
| `/api/billing/webhook` | Stripe webhook; no user context |
| `/api/integrations/*/callback` | OAuth completion; bind tokens even after a billing lapse so the user isn't stranded mid-flow |
| `/api/sentry-check` | Diagnostic only |

**Gap check on paid-value mutating routes:** ZERO unprotected
mutating-with-value routes remain at the time of this audit.

## 4. Audit logging

Actions that MUST write `audit_logs` and whether they do:

| Action | Logged? | Where |
|---|---|---|
| Signup completion | n/a | Supabase auth has its own log |
| Onboarding finalize | ✓ | `/api/onboarding/finalize` `onboarding.completed` |
| Invite redemption | ✓ | `/api/onboarding/finalize` `invite.redeemed` |
| Practice create | ✓ | onboarding.completed (above) |
| Practice delete | ✗ row cascades — ⚠️ see Sentry hook | `/api/practice/delete` |
| Role change | ✓ | `/api/team/role` `team.role_changed` |
| Member add / remove / leave | ✓ | `/api/team/*` |
| Member rename | ✓ | `/api/team/name` |
| Join request approve / deny | ✓ | `/api/team/requests/:id` |
| Invite created | DB-side | `invite_codes` table itself (granted_by + granted_at) |
| Invite revoked | DB-side | `invite_codes.revoked_at` |
| Integration connected | ✓ | each connect/callback route |
| Integration disconnect | n/a (not implemented as endpoint) | — |
| Policy generated | ✓ | `/api/policies/generate` |
| Policy acknowledged | ✓ | `/api/policies/:id/acknowledge` |
| Training completed | ✓ | `/api/training/:id/complete` |
| Evidence uploaded / committed | ✓ via runEvidenceFlow | `/api/evidence/finalize` |
| Manual attestation | ✓ via runEvidenceFlow | `/api/evidence/attest` |
| Report generated | ✓ | `/api/reports/generate` |
| Risk assessment | ✓ | `/api/risk-assessment` |
| Attestation generated | ✓ via generateAttestation | `/api/attestations` |
| Attestation signed | ✓ | `/api/attestations/:id/sign` |
| Task created | ✓ | `/api/tasks` writes `task.created` |
| Task status change | ✓ | `/api/tasks/:id` writes `task.<status>` (status changes only — see ³) |
| Screening run / verified / overridden | ✓ via service helpers | `/api/screening/*` |
| Subscription state change | ✓ | `/api/billing/webhook` |
| Cron readiness digest | ✓ | `/api/cron/readiness-digest` |
| Manual workforce screening retry | ✓ via service | — |

**One actionable gap:** practice deletion has no surviving audit trail.
Safe cleanup applied in this pass: emit a `Sentry.captureMessage()` call
with the practice metadata BEFORE the delete cascade, so an external
system retains the event.

## 5. PHI safety

All free-text inputs scanned by the regex-based PHI scanner
(`lib/compliance/phi-scanner.ts`). The scan blocks the write and surfaces
a 422 if any pattern matches (SSN, MRN labels, DOB labels, patient
identifiers, ICD-10, diagnosis keywords).

| User-input surface | Scanned? | Notes |
|---|---|---|
| Signup email | regex on email format | not a PHI risk surface |
| Onboarding practice_name, description, assistance_notes | ✓ | `scanFieldsForPhi` in finalize |
| Onboarding employee free-text | ✓ | scanFieldsForPhi |
| Policy title, policy_type | ✓ | `phiFields` in parseBody |
| Task title, notes | ✓ | parseBody phiFields |
| Evidence finalize file_name + notes | ✓ | scanFields explicit (after upload but before persist) |
| Evidence attest statement | ✓ | parseBody phiFields |
| Screening first/last/middle name, address | ✓ | parseBody phiFields |
| Screening override reason | ✓ | parseBody phiFields |
| Team rename full_name | ✓ | parseBody phiFields |
| Team join-request denial_reason | ✓ | parseBody phiFields |
| Uploaded file contents | ✗ — by design | Defense-in-depth at architecture level (no-phi commitment); filename + notes scanned, file blob not parsed |
| Attestation generation | n/a | No user free-text input — type enum only |
| Risk assessment answers | n/a | Multiple choice; no free-text |

**Pattern check:** every route with a free-text body field passes that
field through `phiFields` on `parseBody()`, OR explicitly calls `scanFields`
before any DB write. Failure mode is 422 → write rejected → file (if any)
deleted from storage.

## 6. Demo invite safety

| Property | Status | Where enforced |
|---|---|---|
| Plaintext codes hashed at rest | ✓ sha256 in `invite_codes.code_hash` (migration 042) | DB schema |
| Plaintext returned to granter once | ✓ in POST response; never read back | `/api/admin/invites` |
| Atomic redemption (no over-redeem races) | ✓ `redeem_invite_code` RPC takes row lock | migration 042 |
| `max_uses` enforced | ✓ checked inside RPC before insert | migration 042 |
| `link_expires_at` enforced | ✓ checked inside RPC | migration 042 |
| `access_duration_minutes` enforced | ✓ RPC sets `practices.access_expires_at` | migration 042 |
| Per-user double-redeem blocked | ✓ unique `(code_id, user_id)` on redemptions | migration 041 |
| Admin-only creation | ✓ `isFortifyAdmin(user.email)` against FORTIFY_ADMIN_EMAILS | `/api/admin/invites` |
| Admin-only revocation | ✓ same gate + granter ownership check | `/api/admin/invites/:id/revoke` |
| Expired demo blocks new work | ✓ `requirePracticeAccess` returns 402 on mutating routes | every paid-value route |
| Expired demo allows read-only viewing | ✓ access banner on app shell; reads not gated | `app/app/layout.tsx` + `AccessBanner.tsx` |
| Expired demo can subscribe | ✓ `/api/billing/checkout` intentionally ungated | matrix above |
| RLS on invite tables | ✓ granter-own read/write + practice-member read for redemptions | migration 041 |
| Rate limit on code preview (anti-enumeration) | ✓ `signup` bucket per IP | `/api/invites/preview` |

**Pattern check passed end-to-end.** A leak of the DB read access today
exposes only sha256 hashes — not redeemable URLs.

## 7. Satisfaction / readiness correctness

The chain that turns evidence into a score:

```
evidence_check.satisfaction_rule (jsonb declared in 034, backfilled in 035)
       │
       ▼
evaluate_satisfaction_rule(practice, ec)   ← migration 042
       │  evaluates "any_of" against current practice_evidence rows
       ▼
recompute_practice_control_status(practice)  ← migration 042
       │  walks practice_controls, flips status → compliant/partial/non_compliant
       ▼
audit_readiness(practice, framework)        ← rewritten in 038, hardened in 042
       │  weights satisfaction × freshness × overdue/baa/screening/drift penalties
       ▼
audit_readiness_v2(practice)                ← 038
       │  fans across enabled frameworks; returns score + signals
       ▼
/api/reports/generate, /api/attestations    ← recompute called FIRST in 042
       │
       ▼
DashboardClient + report PDF + attestation snapshot
```

| Step | Implemented? | Wired up? |
|---|---|---|
| Satisfaction rule jsonb on evidence_checks | ✓ migration 034 | ✓ backfilled in 035 |
| Rule evaluator v1 (any_of) | ✓ migration 042 | ✓ delegates to v2 since 043 |
| Rule evaluator v2 (any_of + all_of + reviewer + priority + type + integration + exception) | ✓ migration 043 | ✓ called by recompute |
| Control exceptions table | ✓ migration 043 | ✓ honored by v2 evaluator |
| Recompute SQL function | ✓ migration 042; not_started bug fixed in 044 | ✓ daily cron + on-demand from reports/attestations |
| Daily cron | ✓ `/api/cron/recompute-control-status` | ✓ scheduled in vercel.json 05:15 UTC |
| On-demand recompute before reads | ✓ in `/api/reports/generate`, `lib/attestation/generate.ts::buildSnapshot`, AND `app/app/page.tsx` (dashboard) | ✓ dashboard recompute added 2026-06-12 so the critical-findings badge count can't under-report risk between nightly cron runs |
| Readiness penalties on tasks/BAAs/screenings/drift | ✓ migration 042 audit_readiness rewrite | ✓ flows through audit_readiness_summary + v2 |
| Dashboard surfaces v2 signals | ✓ `app/app/page.tsx` calls v2 | ✓ DashboardClient renders signal strip |
| Tests for rule behavior — real DB | ✓ `scripts/ci/satisfaction-rule-ci-test.sql` (9 scenarios) runs in CI against a Postgres service container (`.github/workflows/db-tests.yml`); a vitest guard (`tests/ci-sql-sync.test.ts`) keeps it in sync with the corrected evaluator | superseded the two earlier hand-run scripts, which referenced columns that never existed on practice_evidence (`source`/`evidence_type`/`collected_by_user_id`) and would have errored against the real schema — removed in migration-045 cleanup |
| Tests for access state | ✓ `tests/access-state.test.ts` + `tests/require-access.test.ts` | 19 cases |
| Tests for invite token | ✓ `tests/invite-token.test.ts` | 6 cases |
| Tests for satisfaction-rule TS shape + recompute-first wiring | ✓ `tests/satisfaction-rule.test.ts` | covers contract |
| Tests for route-level access gating across 27 routes | ✓ `tests/route-access-gating.test.ts` | covers active/expired/unpaid for every paid-value route |

**Loop check:** running the SQL self-check script (transactional rollback)
asserts the chain end-to-end. Vitest covers the TypeScript surface
(access-state, require-access, invite tokens, sanitizer, scoring).

## 8. Durable platform audit log

Added in migration 043. The `platform_audit_logs` table is the operator
forensic record for events that must survive tenant deletion:

| Event | Source | When written |
|---|---|---|
| `practice.deleted` | `/api/practice/delete` | Before the cascade |
| `invite.created` | `/api/admin/invites` | After insert |
| `invite.revoked` | `/api/admin/invites/:id/revoke` | After update |
| `billing.subscription_started` | `/api/billing/webhook` | On checkout.session.completed |
| `billing.subscription_changed` | `/api/billing/webhook` | On customer.subscription.updated |
| `billing.subscription_canceled` | `/api/billing/webhook` | On customer.subscription.deleted |
| `billing.invoice_failed` | reserved | (not yet wired) |
| `platform.impersonation_started` | reserved | (no impersonation endpoint today) |
| `platform.impersonation_ended` | reserved | (no impersonation endpoint today) |
| `platform.manual_data_export` | reserved | (no export endpoint today) |

**Schema choices:**

- `practice_id` is `text`, NOT a foreign key. Survives the practice
  being deleted. The display name is captured in `practice_name` for
  human-readable audit views.
- `actor_user_id` is a FK to `auth.users` but `on delete set null`, so
  user deletion only nulls the link, doesn't drop the row.
- `payload jsonb` carries event-specific detail. Loose schema by design.
- RLS denies all authenticated reads. The table is operator-facing;
  reach it via the service-role client or directly via Supabase studio.

**Helper:** `lib/audit/platform.ts::logPlatformEvent(db, event)` writes
the row AND mirrors to Sentry as a breadcrumb so the forensic trail
survives even a DB write failure.

## 9. Expired-demo enforcement (zero-access policy)

**Decision (2026-06-08):** an expired demo grants NO access to the in-app
surface. Not even read-only. The user is redirected from `/app/*` to
`/pricing?expired=demo` (or `?expired=unpaid` for canceled subscriptions).
This is enforced in `app/app/layout.tsx` and runs once per page render.

Rationale: a demo grant is a controlled-window evaluation, not an
indefinite read-only tier. Allowing post-expiry browsing dilutes the
value of the demo invitation and creates ambiguity about what counts as
a "trial" — Fortify has no free trial; it has a satisfaction guarantee.

Previously (before this revision) the gate was mutation-only and an
expired demo could still view the dashboard. The current code:

```
app/app/layout.tsx → computeAccessState(practice) → if not active, redirect("/pricing?expired=…")
```

The mutating route gates (`requirePracticeAccess`) remain as defense in
depth — they catch any API call from a stale browser session that
hasn't been redirected yet.

The deleted `components/app/AccessBanner.tsx` is gone with this change;
its job is now done by the redirect + a notice block at the top of
`/pricing` that reads the `expired` query parameter.

## 10. Open follow-ups (NOT addressed in this pass)

Each of these is real but doesn't meet the "safe cleanup" bar — they
involve schema changes or behavior shifts that warrant their own PRs.

1. Move multi-table service-role writes (onboarding finalize, team/add,
   policies/acknowledge, screening helpers) into SECURITY DEFINER RPCs
   with explicit `WITH CHECK` guards. Cuts service-role surface area.
2. Move `audit_logs.practice_id` to nullable so practice-deletion can
   leave a NULL-practice audit row instead of relying on Sentry alone.
3. Task create/update audit_log rows — nice for compliance audits but
   the `remediation_tasks` row is already self-auditing.
4. Integration disconnect endpoints (none today; only connect/callback).
   Cleanup before customer onboarding.
5. Per-tenant rate limits beyond IP — currently rate-limiting is global
   per-IP (signup, screening). A noisy practice could starve others.

## Verification — run when in doubt

```bash
# Static
npx tsc -p tsconfig.json --noEmit       # type contract
npx eslint . --ext .ts,.tsx             # lint
npm test                                # vitest unit suite

# Live
npm run build                           # full prod build

# Satisfaction-rule DB test (CI runs this against a Postgres service):
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/ci/satisfaction-rule-ci-test.sql
```
