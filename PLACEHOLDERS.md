# Placeholders & Pending Work

**Last reviewed: 2026-07-06.** Tracked list of everything scaffolded but
incomplete, plus the external actions only a human with dashboard access can
do. Everything is gracefully no-op-safe; nothing crashes when an underlying
account or service isn't connected.

## One-time human actions still pending

| Action | Where | Why it can't be done from code |
|---|---|---|
| Confirm OAuth redirect URIs point at fortifynow.xyz | Entra / Google Cloud / DocuSign consoles (+ Vercel env `MS_REDIRECT_URI`, `GOOGLE_REDIRECT_URI`, `DOCUSIGN_REDIRECT_URI` if wrong) | External consoles; env values are pull-protected so unverifiable from CLI. Likely already correct (vars created right after the domain went live). 30-second test: click Connect on /app/integrations — consent screen = correct, redirect_uri_mismatch = fix |
| Verify Resend sending domain | Resend dashboard + Cloudflare DNS | DNS records; no Resend API key available locally to check status |
| Stripe products + webhook + env vars | Stripe dashboard | Deliberately deferred (user decision) |
| Vercel Pro upgrade (cron limits) | Vercel dashboard | Deliberately deferred; Hobby silently caps the 6 declared crons |
| Terms of Service with no-PHI clause | Lawyer | Deliberately deferred |

Done 2026-07-06 (via Management API / Vercel CLI): migrations 048 + 049
applied and verified in prod (grants + RLS + live /join E2E); all 4 Supabase
auth email templates branded + subjects set; Site URL + redirect allow-list
confirmed; unused `NVD_API_KEY` / `OTX_API_KEY` removed from Vercel prod.

## Feature stubs

| Feature | Location | Status |
|---|---|---|
| BAA document upload | `app/app/vendors/VendorsClient.tsx` | `baas.document_url` exists in schema; upload UI not built (evidence-storage pattern is ready to reuse) |

## Integration runners not yet implemented

Inside `lib/compliance/runner.ts`, these `source_integration` values return
`{ status: "not_collected" }` until built: `datto`, `connectwise`, `scanner`.
(M365, Google Workspace, Okta, AWS, and DocuSign runners are live.)

## Resolved since the last revision of this file

- Real email team invites: `practice_invites` + `/api/invites/queue` +
  `/join/<token>` + silent redemption in the auth callback (migration 048
  applied to prod 2026-07-06)
- Native PDF export for reports and attestations (`lib/pdf/*`,
  `/api/reports/[id]/pdf`, `/api/attestations/[id]/pdf`) — print views remain
  for wet-ink signing
- Drift-alert emails (verify-compliance cron) and BAA-expiry alerts
  (task-reminders cron, 30/14/7/3/1-day milestones)
- Integration disconnect endpoint + UI (`/api/integrations/disconnect`)
- Per-practice rate limits on the three AI routes
- `task.edited` audit rows for non-status task edits
- Evidence upload/download UI, policy acknowledgment UI, training UI,
  Sentry, CI (`ci.yml` + `db-tests.yml`), custom domain serving prod
