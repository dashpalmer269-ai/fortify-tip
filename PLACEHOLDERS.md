# Placeholders & Pending Work

Tracked list of every feature that is scaffolded but incomplete. Each one is
gracefully no-op-safe today; nothing crashes when the underlying account or
service isn't connected.

## External services not yet connected (env vars needed)

| Service | Env vars | What unlocks | File |
|---|---|---|---|
| **Resend (email)** | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Welcome email, invite emails, BAA-expiring alerts, drift-alert emails | `lib/email/provider.ts` |
| **Stripe (billing)** | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PRACTICE`, `STRIPE_PRICE_MULTISITE` | Pricing page checkout, in-app subscription management | `app/api/billing/checkout/route.ts` |
| **Microsoft 365** | `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_REDIRECT_URI` | Automated MFA / audit-log / BitLocker evidence collection | `app/api/integrations/m365/connect/route.ts` |

## Feature stubs

| Feature | Location | Status |
|---|---|---|
| Evidence file upload UI | `app/app/compliance/ComplianceBrowser.tsx` (Upload evidence button) | Disabled button; needs Supabase Storage bucket + uploader |
| BAA document upload | `app/app/vendors/VendorsClient.tsx` | Document URL field exists in schema; UI for uploading not built |
| Policy acknowledgment workflow | `app/app/policies/[id]/page.tsx` | Schema has `policy_acknowledgments` table; UI not built |
| PDF export for reports | `app/app/reports/[id]/page.tsx` | "Print to PDF" fallback works; native PDF needs `puppeteer` or `pdf-lib` |
| Training module UI | None yet | Schema exists (`training_modules`, `training_completions`); UI to seed/take/track is Phase F.5 |
| Risk assessment empty-state CTA dedup | `app/app/risk-assessment/page.tsx` | Header button + empty-state button both link to /new — minor UX redundancy |
| Real email-based invites | `app/api/invites/queue/route.ts` | Currently writes to audit_logs only; needs `practice_invites` table + email worker |

## Integration runners not yet implemented

Inside `lib/compliance/runner.ts`, these `source_integration` values return
`{ status: "not_collected" }` until built:

- `aws` — IAM MFA, S3 encryption, CloudTrail config
- `datto` — Backup health, restore-test attestations
- `connectwise` — RMM patch state, endpoint inventory
- `scanner` — Public-facing TLS, port scan probes

## Infrastructure decisions deferred

| Decision | Rationale | Trigger |
|---|---|---|
| Supabase Team plan + HIPAA add-on (~$599/mo) | "Build now, upgrade before first paying customer" | First signed LOI / pilot agreement |
| Vercel Pro or Enterprise (BAA) | Same as above; Hobby caps crons at 1/day | First customer requiring written BAA |
| Custom domain | Cosmetic | Pre-launch |
| Stripe BAA | If you process any PHI through Stripe metadata (you shouldn't) | Only if needed |

## Known minor UX paper-cuts

These don't break anything but could be cleaner:

- Sidebar shows "Threat intel" tab to every user; consider gating per-tier later
- The compliance browser's evidence upload button is disabled with no tooltip explaining
- The `/app/threats/*` pages still use the old `createServerClient` (service role) since the data is global; switching to authed client is mostly cosmetic but more consistent

---

**Triage order I'd recommend** when you come back to this list:
1. Resend API key (cheapest unlock, 3k emails/mo free, makes the welcome flow real)
2. Evidence upload UI + Supabase Storage bucket (highest customer-perceived value)
3. PDF export for reports (auditors expect this format)
4. Microsoft 365 OAuth env vars (automated evidence is the killer demo)
5. Stripe (only when ready to actually take money)
