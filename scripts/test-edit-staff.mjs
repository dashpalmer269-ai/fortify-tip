#!/usr/bin/env node
// Test the /api/team/name endpoint:
//  - admin can rename a member of their practice
//  - non-admin (staff) can't rename anyone (403)
//  - cross-practice admin can't rename someone in another practice (404)
//  - empty / oversized names are rejected (400)
//  - audit log entry written

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
async function finalize(cookie, practiceName) {
  const r = await fetch(`${APP}/api/onboarding/finalize`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      state: {
        information: {
          practice_name: practiceName, description: "test", employee_range: "21-50", location_count_range: "1-2",
          locations: [{ label: "", street_1: "1", street_2: "", city: "A", region: "TX", postal_code: "1" }],
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
const restDel = (p) => fetch(`${SB}/rest/v1/${p}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
const restGet = (p) => fetch(`${SB}/rest/v1/${p}`, { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }).then((r) => r.json());

async function main() {
  const PASS = "Pass!123Strong";
  const t = Date.now();

  step(1, "Setup: practice A (admin + staff), practice B (admin)");
  const adminA = await adminCreate(`adminA-${t}@edit.local`, PASS, "admin");
  const sessAA = await signIn(`adminA-${t}@edit.local`, PASS);
  const cAA = cookieFor(sessAA);
  const pAId = await finalize(cAA, `Edit Test A ${t}`);

  const adminB = await adminCreate(`adminB-${t}@edit.local`, PASS, "admin");
  const sessAB = await signIn(`adminB-${t}@edit.local`, PASS);
  const cAB = cookieFor(sessAB);
  const pBId = await finalize(cAB, `Edit Test B ${t}`);
  created.practiceIds.push(pAId, pBId);

  // Standard joins A, gets approved as staff
  const standard = await adminCreate(`std-${t}@edit.local`, PASS, "employee");
  await fetch(`${APP}/api/onboarding/employee`, {
    method: "POST", headers: { cookie: cookieFor(await signIn(`std-${t}@edit.local`, PASS)), "content-type": "application/json" },
    body: JSON.stringify({ full_name: "Original Name", job_title: "Tech", phone: null, pending_practice_name: `Edit Test A ${t}`, claimed_admin_name: "A", primary_address: { street_1: "1", street_2: null, city: "A", region: "TX", postal_code: "1" } }),
  });
  await fetch(`${APP}/api/team/requests/${standard.id}`, {
    method: "POST", headers: { cookie: cAA, "content-type": "application/json" },
    body: JSON.stringify({ action: "approve", role: "staff" }),
  });
  ok(`practice A has admin + 1 approved staff; practice B has admin`);

  // ── Edge 1: admin renames staff ─────────────────────────────────────────
  step(2, "Admin A renames staff");
  const r1 = await fetch(`${APP}/api/team/name`, {
    method: "POST", headers: { cookie: cAA, "content-type": "application/json" },
    body: JSON.stringify({ practice_id: pAId, target_user_id: standard.id, full_name: "Updated Name" }),
  });
  if (!r1.ok) { fail(`rename: ${r1.status} ${await r1.text()}`); }
  else {
    const p = await restGet(`user_profiles?user_id=eq.${standard.id}&select=full_name`);
    if (p[0]?.full_name === "Updated Name") ok(`profile.full_name updated`);
    else fail(`profile.full_name not updated: ${JSON.stringify(p)}`);
  }

  // ── Edge 2: admin renames themselves (creates profile if missing) ──────
  step(3, "Admin A renames themselves (no existing profile)");
  const r2 = await fetch(`${APP}/api/team/name`, {
    method: "POST", headers: { cookie: cAA, "content-type": "application/json" },
    body: JSON.stringify({ practice_id: pAId, target_user_id: adminA.id, full_name: "Admin A Name" }),
  });
  if (!r2.ok) { fail(`self-rename: ${r2.status} ${await r2.text()}`); }
  else {
    const p = await restGet(`user_profiles?user_id=eq.${adminA.id}&select=full_name,status`);
    if (p[0]?.full_name === "Admin A Name") ok(`admin's profile created on the fly with name`);
    else fail(`admin profile not created: ${JSON.stringify(p)}`);
  }

  // ── Edge 3: staff tries to rename someone ───────────────────────────────
  step(4, "Staff attempts to rename admin");
  const sessStd = await signIn(`std-${t}@edit.local`, PASS);
  const r3 = await fetch(`${APP}/api/team/name`, {
    method: "POST", headers: { cookie: cookieFor(sessStd), "content-type": "application/json" },
    body: JSON.stringify({ practice_id: pAId, target_user_id: adminA.id, full_name: "hacker" }),
  });
  if (r3.status === 403) ok(`staff rename → 403`);
  else fail(`expected 403, got ${r3.status}`);

  // ── Edge 4: cross-practice admin tries to rename ────────────────────────
  step(5, "Admin B (different practice) tries to rename staff in practice A");
  const r4 = await fetch(`${APP}/api/team/name`, {
    method: "POST", headers: { cookie: cAB, "content-type": "application/json" },
    body: JSON.stringify({ practice_id: pAId, target_user_id: standard.id, full_name: "x" }),
  });
  if (r4.status === 403) ok(`cross-practice admin → 403`);
  else fail(`expected 403, got ${r4.status}: ${await r4.text()}`);

  // ── Edge 5: empty name ──────────────────────────────────────────────────
  step(6, "Empty name");
  const r5 = await fetch(`${APP}/api/team/name`, {
    method: "POST", headers: { cookie: cAA, "content-type": "application/json" },
    body: JSON.stringify({ practice_id: pAId, target_user_id: standard.id, full_name: "   " }),
  });
  if (r5.status === 400) ok(`empty name → 400`);
  else fail(`expected 400, got ${r5.status}`);

  // ── Edge 6: oversized name ──────────────────────────────────────────────
  step(7, "Oversized name (>120 chars)");
  const r6 = await fetch(`${APP}/api/team/name`, {
    method: "POST", headers: { cookie: cAA, "content-type": "application/json" },
    body: JSON.stringify({ practice_id: pAId, target_user_id: standard.id, full_name: "x".repeat(200) }),
  });
  if (r6.status === 400) ok(`200-char name → 400`);
  else fail(`expected 400, got ${r6.status}`);

  // ── Audit log ───────────────────────────────────────────────────────────
  step(8, "Audit log entry");
  const audit = await restGet(`audit_logs?practice_id=eq.${pAId}&action=eq.team.name_updated&select=metadata`);
  if (audit.length >= 2) ok(`team.name_updated logged ${audit.length}x`);
  else fail(`expected ≥2 audit entries, got ${audit.length}`);

  step(9, "Cleanup");
  for (const id of created.practiceIds) await restDel(`practices?id=eq.${id}`);
  for (const id of created.users) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  }
  ok("cleaned up");

  console.log(`\n${process.exitCode ? C.r + "━━ TEST FAILED ━━" : C.g + "━━ EDIT STAFF TESTS PASSED ━━"}${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  for (const id of created.practiceIds) await restDel(`practices?id=eq.${id}`).catch(() => {});
  for (const id of created.users) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }).catch(() => {});
  }
});
