#!/usr/bin/env node
// End-to-end check: submitting PHI to onboarding endpoints returns 422
// before anything reaches the database.

import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = "http://localhost:3456";

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", x: "\x1b[0m" };
const step = (n, t) => console.log(`\n${C.y}[${n}]${C.x} ${t}`);
const ok = (m) => console.log(`  ${C.g}✓${C.x} ${m}`);
const fail = (m) => { console.log(`  ${C.r}✗${C.x} ${m}`); process.exitCode = 1; };
const created = { users: [] };

async function adminCreate(email, password, accountType) {
  const r = await fetch(`${SB}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { account_type: accountType } }),
  });
  const u = await r.json();
  created.users.push(u.id);
  return u;
}
async function signIn(email, password) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
}
function cookieFor(s) {
  const ref = new URL(SB).hostname.split(".")[0];
  const tok = { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at, token_type: "bearer", user: s.user };
  return `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(tok)).toString("base64url")}`;
}

async function main() {
  const PASS = "Pass!123Strong";
  const t = Date.now();
  const admin = await adminCreate(`phi-admin-${t}@test.local`, PASS, "admin");
  const adminC = cookieFor(await signIn(`phi-admin-${t}@test.local`, PASS));
  const std = await adminCreate(`phi-std-${t}@test.local`, PASS, "employee");
  const stdC = cookieFor(await signIn(`phi-std-${t}@test.local`, PASS));

  // ── 1. Admin finalize with PHI in description ──────────────────────────
  step(1, "Admin /finalize with SSN in description → 422");
  const r1 = await fetch(`${APP}/api/onboarding/finalize`, {
    method: "POST", headers: { cookie: adminC, "content-type": "application/json" },
    body: JSON.stringify({
      state: {
        information: {
          practice_name: "Test " + t, description: "Family medicine. Pt SSN 123-45-6789 attached.",
          employee_range: "21-50", location_count_range: "1-2",
          locations: [{ label: "", street_1: "1", street_2: "", city: "A", region: "TX", postal_code: "1" }],
        },
        fortification: { current_status: "starting_brand_new", upcoming_audit_window: "within_90_days" },
        safeguards: { mode: "manual", integrations: [], assistance_date: "", assistance_window: "", assistance_phone: "", assistance_notes: "" },
        payment: { selected_plan: "practice" },
      },
      existing_practice_id: null,
    }),
  });
  const b1 = await r1.json();
  if (r1.status === 422) ok(`status 422, msg: "${b1.error.slice(0, 80)}..."`);
  else fail(`expected 422, got ${r1.status}: ${JSON.stringify(b1).slice(0, 120)}`);

  // ── 2. Admin finalize with PHI in practice name ────────────────────────
  step(2, "Admin /finalize with MRN in practice name → 422");
  const r2 = await fetch(`${APP}/api/onboarding/finalize`, {
    method: "POST", headers: { cookie: adminC, "content-type": "application/json" },
    body: JSON.stringify({
      state: {
        information: {
          practice_name: "Practice MRN: 5559876", description: "general",
          employee_range: "21-50", location_count_range: "1-2",
          locations: [{ label: "", street_1: "1", street_2: "", city: "A", region: "TX", postal_code: "1" }],
        },
        fortification: { current_status: "starting_brand_new", upcoming_audit_window: "within_90_days" },
        safeguards: { mode: "manual", integrations: [], assistance_date: "", assistance_window: "", assistance_phone: "", assistance_notes: "" },
        payment: { selected_plan: "practice" },
      },
      existing_practice_id: null,
    }),
  });
  if (r2.status === 422) ok(`MRN in name → 422`);
  else fail(`expected 422, got ${r2.status}: ${(await r2.text()).slice(0, 120)}`);

  // ── 3. Standard with DOB in claimed_admin_name ─────────────────────────
  step(3, "Standard /employee with DOB phrase in admin name → 422");
  const r3 = await fetch(`${APP}/api/onboarding/employee`, {
    method: "POST", headers: { cookie: stdC, "content-type": "application/json" },
    body: JSON.stringify({
      full_name: "Jane Doe", job_title: "Tech", phone: null,
      pending_practice_name: "Some Practice", claimed_admin_name: "Boss DOB: 1985-01-01",
      primary_address: { street_1: "1", street_2: null, city: "A", region: "TX", postal_code: "1" },
    }),
  });
  if (r3.status === 422) ok(`DOB in admin name → 422`);
  else fail(`expected 422, got ${r3.status}: ${(await r3.text()).slice(0, 120)}`);

  // ── 4. Standard with patient identifier phrase in job_title ────────────
  step(4, "Standard /employee with 'patient name' phrase → 422");
  const r4 = await fetch(`${APP}/api/onboarding/employee`, {
    method: "POST", headers: { cookie: stdC, "content-type": "application/json" },
    body: JSON.stringify({
      full_name: "OK Name", job_title: "Manages patient name records",
      phone: null, pending_practice_name: "P", claimed_admin_name: "Admin",
      primary_address: { street_1: "1", street_2: null, city: "A", region: "TX", postal_code: "1" },
    }),
  });
  if (r4.status === 422) ok(`patient phrase → 422`);
  else fail(`expected 422, got ${r4.status}: ${(await r4.text()).slice(0, 120)}`);

  // ── 5. Clean input still works ─────────────────────────────────────────
  step(5, "Clean standard submission still succeeds");
  const r5 = await fetch(`${APP}/api/onboarding/employee`, {
    method: "POST", headers: { cookie: stdC, "content-type": "application/json" },
    body: JSON.stringify({
      full_name: "Jane Doe", job_title: "Office Manager", phone: null,
      pending_practice_name: "Clean Practice " + t, claimed_admin_name: "Sarah Chen",
      primary_address: { street_1: "1 Main", street_2: null, city: "Austin", region: "TX", postal_code: "78701" },
    }),
  });
  if (r5.ok) ok(`clean submission accepted`);
  else fail(`clean submission rejected: ${r5.status} ${(await r5.text()).slice(0, 120)}`);

  // Cleanup
  for (const id of created.users) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  }
  console.log(`\n${process.exitCode ? C.r + "━━ FAILED ━━" : C.g + "━━ NO-PHI E2E PASSED ━━"}${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  for (const id of created.users) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }).catch(() => {});
  }
});
