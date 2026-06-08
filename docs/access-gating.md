# Access-gating matrix

Every POST / PATCH / PUT / DELETE route in Fortify, classified by the four
guards it should pass through. The matrix is the source of truth — when
adding a new route, decide what each column should be FIRST, then encode
the answers in the route handler.

## Columns

- **Billing**: requires the practice to have an active subscription OR an
  unexpired demo grant (computeAccessState → kind: active). Enforced by
  `requirePracticeAccess(db, practiceId)` from `lib/billing/require-access.ts`.
- **Admin**: requires the caller to be `owner` / `admin` / `compliance_officer`
  of the target practice. Enforced via `isAdmin(role)` from
  `lib/auth/permissions.ts`.
- **Service role**: route uses the service-role Supabase client AT ALL.
  This is acceptable for bootstrap, cross-tenant, or auth.users access —
  but should NEVER be the path that authenticates the caller.
- **Onboarding**: allowed during the no-practice / pending state. Routes
  here either create a practice (finalize) or join one (employee).

## The matrix

| Route                                          | Billing | Admin | Service role | Onboarding |
|------------------------------------------------|---------|-------|--------------|------------|
| **Onboarding & signup**                        |         |       |              |            |
| POST /api/auth/signup                          | n/a     | no    | no           | yes        |
| POST /api/onboarding/employee                  | n/a     | no    | yes (bootstrap) | yes      |
| POST /api/onboarding/finalize                  | n/a     | no    | yes (bootstrap) | yes      |
| **Billing**                                    |         |       |              |            |
| POST /api/billing/checkout                     | **no**¹ | no    | no           | no         |
| POST /api/billing/webhook                      | n/a     | n/a   | yes (system) | n/a        |
| **Fortify-admin**                              |         |       |              |            |
| POST /api/admin/invites                        | n/a     | n/a²  | yes          | no         |
| POST /api/admin/invites/:id/revoke             | n/a     | n/a²  | yes          | no         |
| GET  /api/sentry-check                         | n/a     | n/a²  | no           | no         |
| **Evidence (mutating)**                        |         |       |              |            |
| POST /api/evidence/upload                      | yes ✅   | yes   | yes (signing) | no        |
| POST /api/evidence/finalize                    | yes ✅   | yes   | yes (storage) | no        |
| POST /api/evidence/attest                      | yes ✅   | yes   | yes          | no         |
| **Policies**                                   |         |       |              |            |
| POST /api/policies/generate                    | yes ✅   | no    | no           | no         |
| POST /api/policies/:id/acknowledge             | yes ✅   | no    | yes (auto-task) | no       |
| **Training**                                   |         |       |              |            |
| POST /api/training/:id/complete                | yes ✅   | no    | yes (audit)  | no         |
| **Reports & attestations**                     |         |       |              |            |
| POST /api/reports/generate                     | yes ✅   | no    | no           | no         |
| POST /api/risk-assessment                      | yes ✅   | no    | no           | no         |
| POST /api/attestations                         | yes ✅   | yes   | yes          | no         |
| POST /api/attestations/:id/sign                | yes ✅   | yes   | yes          | no         |
| **Tasks**                                      |         |       |              |            |
| POST /api/tasks                                | yes ✅   | no    | no           | no         |
| POST /api/tasks/:id                            | yes ✅   | no    | no           | no         |
| **Integrations**                               |         |       |              |            |
| POST /api/integrations/m365/connect            | yes ✅   | yes   | no           | no         |
| POST /api/integrations/google/connect          | yes ✅   | yes   | no           | no         |
| POST /api/integrations/okta/connect            | yes ✅   | yes   | yes (encrypted credentials) | no |
| POST /api/integrations/aws/connect             | yes ✅   | yes   | yes (encrypted credentials) | no |
| POST /api/integrations/docusign/connect        | yes ✅   | yes   | no           | no         |
| **Team**                                       |         |       |              |            |
| POST /api/team/add                             | yes ✅   | yes   | yes (auth.users) | no      |
| POST /api/team/role                            | yes ✅   | yes   | no           | no         |
| POST /api/team/remove                          | yes ✅   | yes   | no           | no         |
| POST /api/team/leave                           | **no**³ | no    | no           | no         |
| POST /api/team/name                            | yes ✅   | yes   | no           | no         |
| POST /api/team/requests/:id                    | yes ✅   | yes   | yes          | no         |
| POST /api/practice/delete                      | **no**⁴ | yes (owner) | yes      | no         |
| POST /api/invites/queue                        | yes ✅   | no    | no           | no         |
| **Screening**                                  |         |       |              |            |
| POST /api/screening/:id/override               | yes ✅   | yes   | yes          | no         |
| POST /api/screening/:id/verify                 | yes ✅   | yes   | yes          | no         |
| POST /api/screening/preliminary                | yes ✅   | yes   | yes          | no         |
| POST /api/screening/vendor                     | yes ✅   | yes   | yes          | no         |
| **Notifications**                              |         |       |              |            |
| POST /api/notifications                        | **no**⁵ | no    | no           | no         |
| **System (cron + callbacks)**                  |         |       |              |            |
| GET  /api/cron/*                               | n/a     | n/a   | yes (system) | n/a        |
| GET  /api/integrations/*/callback              | n/a     | yes (verified via state cookie) | yes | n/a |

¹ Billing checkout — an expired demo MUST be able to subscribe. Gating it would
  trap users.

² Fortify-admin — checked via `isFortifyAdmin(user.email)` against the
  `FORTIFY_ADMIN_EMAILS` env allowlist. Bypasses per-practice membership.

³ Team-leave — a user must always be able to leave a practice they're
  in, regardless of the practice's billing state.

⁴ Practice-delete — owner can always delete their own practice. Gating
  it would orphan unpaid practices forever.

⁵ Notifications POST — only marks notifications as read. Read-flag is
  acceptable even on expired demos so users don't see stale unread
  counts.

## Gaps closed by this audit (commit ref to follow)

These routes previously had no billing gate; this pass added one:
- /api/evidence/upload
- /api/evidence/attest
- /api/attestations
- /api/attestations/:id/sign
- /api/tasks
- /api/tasks/:id
- /api/team/name
- /api/team/requests/:id
- /api/screening/:id/override
- /api/screening/:id/verify
- /api/screening/preliminary
- /api/screening/vendor

## Service-role usage justification (per route)

Service-role bypass RLS. Audit shows each remaining usage is one of these
acceptable patterns:

| Pattern                                | Reason                                    |
|----------------------------------------|-------------------------------------------|
| Onboarding bootstrap                   | User has no practice_users row yet        |
| Cross-tenant admin notification        | Notifying admins of OTHER practices       |
| auth.users read                        | Not exposed to anon/authenticated         |
| Encrypted credentials write            | Sole writer; isolated via CHECK constraint |
| Storage signing                        | Path-prefix-scoped signed URLs            |
| Audit log write                        | All actor_user_id pinned to JWT user.id   |
| Auto-task generation                   | System-generated work on user actions     |
| Cron / webhook                         | No user context — caller verified by signature/secret |

In every case, the calling user's identity is verified via
`createAuthedServerClient()` FIRST, and `user_id` / `actor_user_id` fields
in any write are pinned to that identity. Service-role is the writer of
last resort, never the authenticator.
