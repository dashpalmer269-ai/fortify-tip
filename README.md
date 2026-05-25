# Fortify

AI-native compliance and cybersecurity for healthcare practices. One workspace that unifies **HIPAA, SOC 2, ISO 27001, and GDPR** through a single control library — mark a safeguard compliant once, every framework score it satisfies updates automatically.

Built to do what Vanta and Drata do, for healthcare specifically, at roughly **one-tenth the price**.

## What's in the box

| Module | Purpose |
|---|---|
| **Dashboard** | Live audit-readiness per framework, critical findings, recent activity |
| **Compliance** | The unified control library + per-framework coverage views |
| **Risk Assessment** | Guided 5-minute wizard with Claude-generated executive summaries |
| **Policies** | Versioned policy documents; AI drafts + acknowledgement tracking |
| **Vendors / BAAs** | Business Associate Agreements, vendor risk register |
| **Threat Intel** | NVD CVEs, CISA KEV, OTX pulses, community/forum signals — enriched by Claude |
| **Reports** | Generated audit-ready PDFs with AI executive summaries |
| **Audit Log** | Append-only record of every meaningful change |
| **Team** | Member management with five roles (owner → admin → officer → staff → auditor) |
| **Billing** | Stripe checkout + plan management |

## Stack

- **Next.js 16** (App Router) — full-stack, server components
- **Supabase** — PostgreSQL + Auth + Row Level Security (multi-tenancy)
- **Anthropic Claude** — `claude-opus-4-7` for hard reasoning, `claude-sonnet-4-6` for enrichment
- **Stripe** — billing & checkout
- **Vercel** — hosting + cron (threat-intel ingestion runs 2× daily)
- **Tailwind CSS v4** — styling
- **IBM Plex Serif + Geist + JetBrains Mono + Fraunces** — typography

## Account flows

Sign-up branches at the first step. The user picks **Admin** or **Employee**:

```
Admin path                       Employee path
─────────────────                ─────────────────
1. Information                   1. Information (minimal — name, role,
   (practice profile,               work address, practice they work at)
    employees, locations)
2. Fortification                 2. Submit → /pending
   (framework selection)            (admin must approve)
3. Safeguards                    3. Admin adds them to Team
4. Payment                       4. Dashboard (role-aware)
5. Welcome → Dashboard
```

`user_profiles.account_type` (admin|employee) drives the routing. Dashboards diverge by role: **owner/admin/compliance_officer** see the full readiness/findings dashboard; **staff/auditor_readonly** see the simplified employee dashboard.

## Architecture highlights

- **No PHI — ever.** Fortify is built so it cannot create, receive, maintain, transmit, view, or store Protected Health Information. The rule is hardcoded at four layers: the AI system prompt, the API boundary (`scanFieldsForPhi`), the database (CHECK constraints + `COMMENT ON TABLE`), and the UI (PHI-free badge on every page). See [COMPLIANCE.md](./COMPLIANCE.md).
- **1-Layer Unified Control Mapping Engine** — a single logical layer: `controls` × `framework_mappings` × `framework_requirements`. One row in `controls` maps to N `framework_requirements` via `framework_mappings`. Marking one safeguard compliant updates HIPAA + SOC 2 + ISO 27001 + GDPR readiness at once. The `audit_readiness_summary` Postgres function computes weighted satisfaction; the UI never re-derives scores.
- **Continuous compliance operating system** — daily cron checks (`/api/cron/verify-compliance`), 2×/day threat intel ingestion, automated baseline-control pre-seeding on practice creation, AI-drafted policies, drift alerts on control state changes, append-only audit log.
- **Multi-tenant by default** — every tenant table is RLS-gated. `SECURITY DEFINER` helpers (`user_is_practice_member`, `user_is_practice_admin`) prevent the policy-recursion footguns common to this pattern.
- **AI is plumbed throughout, not bolted on** — risk-assessment summaries, policy drafts, report exec summaries, and threat-intel headlines all flow through `lib/ai/`, all gated by the No-PHI system prompt.

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then run each migration in order via the SQL editor:

```
supabase/migrations/
  001_initial.sql              threats + ingestion_logs
  002_compliance_schema.sql    practices, controls, framework_mappings, RLS scaffolding
  003_vendors_baas.sql         vendor + BAA tables
  004_risk_policies_reports.sql  risk assessments, policies, reports
  005_integrations.sql         onboarding integration choices
  006_fix_rls_recursion.sql    SECURITY DEFINER helpers — MUST run before 008
  007_onboarding_v2.sql        4-step wizard state fields
  008_user_profiles.sql        admin/employee account type + employee profile
```

After running, update **Authentication → URL Configuration** in the Supabase dashboard to point Site URL at your deployed origin (not `localhost`) — otherwise email verification links will land on `localhost`.

### 2. Environment variables

Create `.env.local`:

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Stripe (sandbox keys for dev)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Threat-intel sources
NVD_API_KEY=...          # nvd.nist.gov/developers — free, raises rate limits
OTX_API_KEY=...          # otx.alienvault.com account

# Email (optional — Resend; silently no-ops if absent)
RESEND_API_KEY=re_...

# Cron auth
CRON_SECRET=<any random string>
```

### 3. Run it

```bash
npm install
npm run dev          # localhost:3000
```

### 3a. Database types (one-time setup)

The codebase is typed against the live database schema via `lib/supabase/database.types.ts`. To regenerate after a migration:

```bash
# One-time setup
npm install -g supabase                                  # or use the dev-dep version
export SUPABASE_ACCESS_TOKEN=sbp_...                     # create one at supabase.com/dashboard/account/tokens

# After each migration
npm run db:types                                         # writes lib/supabase/database.types.ts
```

The file is committed so PRs without DB access still build; CI should refuse a PR whose migration changes the schema without an accompanying `database.types.ts` update.

Manually trigger threat-intel ingestion:

```bash
curl "http://localhost:3000/api/cron/ingest?secret=$CRON_SECRET"
```

### 4. Deploy

```bash
vercel --prod
```

Add every env var to **Project → Settings → Environment Variables** in Vercel. Vercel cron is already configured (`vercel.json`) to hit `/api/cron/ingest` at 06:00 and 18:00 UTC daily.

## Project structure

```
app/
  (auth)/login,signup              auth pages (route group keeps them outside /app)
  app/                             authenticated workspace (sidebar + topbar)
    page.tsx                       dashboard — branches admin vs employee
    DashboardClient.tsx            admin/officer dashboard
    DashboardEmployee.tsx          staff/auditor dashboard
    onboarding/                    4-step admin wizard + employee verification form
    compliance, risk-assessment, policies, vendors, threats, reports,
    audit-log, settings, team, billing, integrations
  pending/                         employee waiting-for-approval screen
  auth/callback                    OAuth + email-verify exchange
  api/                             route handlers (onboarding, billing, cron, etc.)
  pricing, intel, page.tsx         marketing surface

components/
  app/                             Sidebar, TopBar (authenticated chrome)
  marketing/                       MarketingNav, UserMenu (signed-in hamburger)
  ui/                              Card, Button, PageHeader, Badge — design primitives

lib/
  ai/                              Claude wrappers (risk, policy, report, threat)
  auth/                            permissions, viewer helpers
  billing/                         Stripe + plans
  email/                           Resend templates
  sources/                         threat-intel adapters (NVD, CISA, OTX, HN, etc.)
  supabase/                        browser, server, server-auth, middleware clients

supabase/migrations/               see Setup → step 1
```

## Roles

| Role | Can do |
|---|---|
| `owner` | Everything, including billing and deleting the practice |
| `admin` | Everything except deleting the practice |
| `compliance_officer` | Manage controls, evidence, policies, reports |
| `staff` | Read most of the workspace; acknowledge policies |
| `auditor_readonly` | Read-only access for external auditors |

Defined in `lib/auth/permissions.ts`. Database RLS is the real gate — the UI just mirrors it.

## Status

Active development. Schema is stabilizing but still evolving — treat the migration list as load-bearing and run them in order on a fresh project.
