#!/usr/bin/env node
// Permission edge cases for the approval endpoints:
//  - Non-admin (staff) tries to call /api/team/requests/[id] → 403
//  - Admin from ANOTHER practice tries to approve a request in your practice → 403
//  - Double-approve (already approved) → 409
//  - Standard tries to call /api/team/requests/[someone else] → 403

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

const created = { users: [], practiceIds: [] };

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
async function adminFinalize(adminCookie, practiceName) {
  const r = await fetch(`${APP}/api/onboarding/finalize`, {
    method: "POST", headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({
      state: {
        information: {
          practice_name: practiceName, description: "test", employee_range: "21-50", location_count_range: "1-2",
          locations: [{ label: "", street_1: "1 Test", street_2: "", city: "Austin", region: "TX", postal_code: "78701" }],
        },
        fortification: { current_status: "starting_brand_new", upcoming_audit_window: "within_90_days" },
        safeguards: { mode: "manual", integrations: [], assistance_date: "", assistance_window: "", assistance_phone: "", assistance_notes: "" },
        payment: { selected_plan: "practice" },
      },
      existing_practice_id: null,
    }),
  });
  return (await r.json()).practice_id;
}
async function submitStandard(cookie, practiceName) {
  await fetch(`${APP}/api/onboarding/employee`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      full_name: "T S", job_title: "Tech", phone: null,
      pending_practice_name: practiceName, claimed_admin_name: "A",
      primary_address: { street_1: "1", street_2: null, city: "A", region: "TX", postal_code: "1" },
    }),
  });
}
const restDel = (p) => fetch(`${SB}/rest/v1/${p}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });

async function main() {
  const PASS = "Pass!123Strong";
  const t = Date.now();
  const practiceA = `Practice A ${t}`;
  const practiceB = `Practice B ${t}`;

  step(1, "Setup: two admins (each owns a practice), staff under A, pending under A");
  const adminA = await adminCreate(`adminA-${t}@perm.local`, PASS, "admin");
  const sessAA = await signIn(`adminA-${t}@perm.local`, PASS);
  const cAA = cookieFor(sessAA);
  const pAId = await adminFinalize(cAA, practiceA);

  const adminB = await adminCreate(`adminB-${t}@perm.local`, PASS, "admin");
  const sessAB = await signIn(`adminB-${t}@perm.local`, PASS);
  const cAB = cookieFor(sessAB);
  const pBId = await adminFinalize(cAB, practiceB);
  created.practiceIds.push(pAId, pBId);

  const pending = await adminCreate(`pending-${t}@perm.local`, PASS, "employee");
  const sessP = await signIn(`pending-${t}@perm.local`, PASS);
  await submitStandard(cookieFor(sessP), practiceA);

  // Approve pending → becomes staff in practiceA
  const approved = await adminCreate(`approved-${t}@perm.local`, PASS, "employee");
  const sessAppr = await signIn(`approved-${t}@perm.local`, PASS);
  await submitStandard(cookieFor(sessAppr), practiceA);
  await fetch(`${APP}/api/team/requests/${approved.id}`, {
    method: "POST", headers: { cookie: cAA, "content-type": "application/json" },
    body: JSON.stringify({ action: "approve", role: "staff" }),
  });
  ok("Practice A + B set up; one pending request, one already-approved staff under A");

  // ── Edge 1: staff tries to approve someone ─────────────────────────────
  step(2, "Staff (non-admin) attempts to approve");
  const sessStaff = await signIn(`approved-${t}@perm.local`, PASS);
  const r1 = await fetch(`${APP}/api/team/requests/${pending.id}`, {
    method: "POST", headers: { cookie: cookieFor(sessStaff), "content-type": "application/json" },
    body: JSON.stringify({ action: "approve", role: "staff" }),
  });
  if (r1.status === 403) ok(`staff approve → 403 Forbidden`);
  else fail(`staff approve: expected 403, got ${r1.status}: ${await r1.text()}`);

  // ── Edge 2: admin from OTHER practice tries to approve ────────────────
  step(3, "Admin from Practice B attempts to approve a Practice A request");
  const r2 = await fetch(`${APP}/api/team/requests/${pending.id}`, {
    method: "POST", headers: { cookie: cAB, "content-type": "application/json" },
    body: JSON.stringify({ action: "approve", role: "staff" }),
  });
  if (r2.status === 403) ok(`cross-practice admin approve → 403`);
  else fail(`cross-practice approve: expected 403, got ${r2.status}: ${await r2.text()}`);

  // ── Edge 3: double-approve the already-approved user ──────────────────
  step(4, "Admin tries to approve someone already approved");
  const r3 = await fetch(`${APP}/api/team/requests/${approved.id}`, {
    method: "POST", headers: { cookie: cAA, "content-type": "application/json" },
    body: JSON.stringify({ action: "approve", role: "staff" }),
  });
  if (r3.status === 409) ok(`double-approve → 409 already-decided`);
  else fail(`double-approve: expected 409, got ${r3.status}: ${await r3.text()}`);

  // ── Edge 4: unauthenticated approve ───────────────────────────────────
  step(5, "Unauthenticated request to approve endpoint");
  const r4 = await fetch(`${APP}/api/team/requests/${pending.id}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "approve", role: "staff" }),
  });
  if (r4.status === 401) ok(`unauth approve → 401`);
  else fail(`unauth approve: expected 401, got ${r4.status}: ${await r4.text()}`);

  // ── Edge 5: standard (pending) tries to approve themselves ────────────
  step(6, "Pending user tries to self-approve");
  const r5 = await fetch(`${APP}/api/team/requests/${pending.id}`, {
    method: "POST", headers: { cookie: cookieFor(sessP), "content-type": "application/json" },
    body: JSON.stringify({ action: "approve", role: "staff" }),
  });
  if (r5.status === 403) ok(`self-approve → 403`);
  else fail(`self-approve: expected 403, got ${r5.status}: ${await r5.text()}`);

  // ── Edge 6: invalid action ────────────────────────────────────────────
  step(7, "Invalid action body");
  const r6 = await fetch(`${APP}/api/team/requests/${pending.id}`, {
    method: "POST", headers: { cookie: cAA, "content-type": "application/json" },
    body: JSON.stringify({ action: "delete" }),
  });
  if (r6.status === 400) ok(`invalid action → 400`);
  else fail(`invalid action: expected 400, got ${r6.status}`);

  // ── Cleanup ───────────────────────────────────────────────────────────
  step(8, "Cleanup");
  for (const id of created.practiceIds) await restDel(`practices?id=eq.${id}`);
  for (const id of created.users) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  }
  ok(`${created.practiceIds.length} practices + ${created.users.length} users deleted`);

  console.log(`\n${process.exitCode ? C.r + "━━ EDGE TESTS FAILED ━━" : C.g + "━━ ALL EDGE CASES PASSED ━━"}${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  for (const id of created.practiceIds) await restDel(`practices?id=eq.${id}`).catch(() => {});
  for (const id of created.users) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }).catch(() => {});
  }
});
