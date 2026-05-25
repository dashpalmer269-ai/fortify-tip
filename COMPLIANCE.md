# Fortify — Architectural Compliance Stance

Fortify is a **continuous compliance operating system** for healthcare practices. We are NOT a clinical system, an EHR, a patient portal, or a claims processor. We operate on the metadata of your compliance program — controls, requirements, vendor risk, threat intel, audit-readiness scoring — never on the patient data those controls protect.

## Hardcoded rule: No PHI

> Fortify must never create, receive, maintain, transmit, view, or store Protected Health Information.
> — 45 CFR § 160.103

This is enforced at **four** layers. None of them is optional, and removing any one of them is a code review blocker.

### 1. Public stance
The home page carries a "PHI-free by design" badge. The dashboard top bar carries the same badge on every authenticated page. Users see this commitment continuously.

### 2. AI boundary
Every Claude API call we make includes `NO_PHI_AI_SYSTEM_PROMPT` (`lib/compliance/no-phi.ts`) as the `system` parameter. This instruction:
- Names PHI by its 18 HIPAA identifiers
- Tells the model to refuse and ask the user to redact if patient data appears
- Restricts the model's domain to compliance/cybersecurity metadata

Every entry point into `lib/ai/` (compliance-ai.ts, processor.ts) is wired to use this prompt. Adding a new AI call without it should fail code review.

### 3. API boundary
`scanFieldsForPhi()` in `lib/compliance/no-phi.ts` is called on every user-supplied text field that lands in the database, before it lands. Detection covers SSNs, MRNs, ICD-10 codes, CPT codes, NPI numbers, DOB phrases, phone numbers in free text, patient identifier phrases, and health-plan IDs.

Currently wired into:
- `POST /api/onboarding/finalize` — practice name, description, assistance notes
- `POST /api/onboarding/employee` — full name, job title, practice name, admin name
- `POST /api/team/requests/[id]` — denial reason
- `POST /api/team/name` — new display name
- `POST /api/policies/generate` — title, policy_type

When PHI is detected, the endpoint returns HTTP 422 with a user-facing message naming the field and category. Nothing is logged with the raw payload.

### 4. Database boundary
`migration 013_no_phi_invariant.sql`:
- `COMMENT ON TABLE` directives on every tenant table state "NO PHI" so any DBA tooling, `pg_dump`, or Supabase Studio session sees the policy in the schema itself.
- A SQL function `_no_phi_check(text)` is applied as a CHECK constraint to high-risk free-text columns (policies.content_markdown, risk_assessments.executive_summary, user_profiles.full_name, etc.). The constraint catches the highest-signal patterns (SSN, MRN) so that even if an API endpoint forgets the boundary check, the database refuses the insert.

`sanitizeForAudit()` strips PHI from any object before it's written to `audit_logs.metadata` or `notifications.body`, so even an audit trail entry never echoes raw user input that contained PHI.

## 1-Layer Unified Control Mapping

Fortify's compliance engine is one logical layer with three tables:

```
controls                framework_mappings                  framework_requirements
─────────────           ─────────────────────────           ───────────────────────
id, control_key,        control_id ─────┐                   id, framework_code,
title, category,        requirement_id  └─→                 requirement_code,
default_priority,       weight                              description, weight
healthcare_baseline                                         (HIPAA §164.308(a)(5)(i),
                                                            SOC 2 CC6.1, etc.)
```

One control row can map to many `framework_requirements` via the join table. Marking a single safeguard compliant updates HIPAA, SOC 2, ISO 27001, and GDPR readiness simultaneously.

The Postgres function `audit_readiness_summary(p_practice_id uuid)` computes weighted satisfaction per framework on the fly — the UI never re-derives scores from the row data.

This is the entire architectural surface for compliance scoring. There is no second layer, no shadow store of pre-computed scores, no per-framework duplicate evidence.

## Continuous operating-system properties

| Property | Mechanism |
|---|---|
| **Continuous monitoring** | Vercel cron (`vercel.json`) hits `/api/cron/verify-compliance` daily. Threat intel ingests 2×/day. |
| **Automation** | AI-drafted policies, AI risk-assessment summaries, AI report executive summaries, automated control pre-seeding on practice creation, baseline healthcare controls auto-applied. |
| **Evidence collection** | `practice_evidence` + `evidence_checks` + `evidence_snapshots` tables; integrations (`onboarding_integration_choices`) feed evidence as it's collected. |
| **Audit log** | Every meaningful state change writes to `audit_logs` with sanitized metadata. Append-only by RLS policy. |
| **Drift detection** | `drift_alerts` table; a control flips from satisfied to non-satisfied creates an alert. |
| **Multi-tenant isolation** | Row-Level Security on every tenant table, SECURITY DEFINER helper functions (`user_is_practice_member`, `user_is_practice_admin`) prevent recursion. |

## What to do if you find PHI in the database

1. Stop. Don't grep for the value across the codebase.
2. Identify which row / column the PHI is in. Use the `_no_phi_check()` constraint logs in `pg_stat_activity` if applicable.
3. NULL the offending column (or replace with a redaction marker) via service-role SQL.
4. Open an incident in your tracker; root-cause the missing boundary check.
5. Add a regression test in `scripts/` that proves the gap is closed.

## Adding a new field

Before merging a PR that adds a free-text column to a tenant table:

- [ ] Could a user paste PHI into this? If yes — add the column to migration 013's CHECK list and the API handler's `scanFieldsForPhi()` call.
- [ ] Does it appear in any AI prompt? If yes — confirm `NO_PHI_AI_SYSTEM_PROMPT` is the `system` parameter on that call.
- [ ] Does it go into audit log metadata? If yes — pass through `sanitizeForAudit()`.
- [ ] Does the table have `COMMENT ON TABLE ... IS 'NO PHI ...'`?
