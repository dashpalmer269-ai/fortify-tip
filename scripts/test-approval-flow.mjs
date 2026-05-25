#!/usr/bin/env node
// End-to-end test of the approval workflow:
//   1. Admin signs up, completes onboarding, creates a practice.
//   2. Standard-A signs up, submits join request with matching practice name.
//   3. Verify: profile is pending, admin got notification, matched_practice_id set.
//   4. Admin approves Standard-A; verify membership row + status flip + notification.
//   5. Standard-B signs up, requests join with matching name.
//   6. Admin denies Standard-B with a reason; verify denied state + notification.
//   7. Edge: Standard-C signs up with a NON-matching practice name; verify unmatched.
// All test users + the practice are deleted at the end.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = "http://localhost:3456";

const PRACTICE_NAME = `Cedar Park Demo ${Date.now()}`;
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", x: "\x1b[0m" };
const step = (n, t) => console.log(`\n${C.y}[${n}]${C.x} ${t}`);
const ok = (m) => console.log(`  ${C.g}✓${C.x} ${m}`);
const fail = (m) => { console.log(`  ${C.r}✗${C.x} ${m}`); process.exitCode = 1; };

const created = { users: [], practiceId: null };

async function adminCreate(email, password, accountType) {
  const r = await fetch(`${SB}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json" },
    body: JSON.stringify({
      email, password, email_confirm: true,
      user_metadata: { account_type: accountType },
    }),
  });
  if (!r.ok) throw new Error(`create ${email}: ${r.status} ${await r.text()}`);
  const u = await r.json();
  created.users.push(u.id);
  return u;
}

async function signIn(email, password) {
  const r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`sign in ${email}: ${r.status} ${await r.text()}`);
  return r.json();
}

function cookieFor(session) {
  const projectRef = new URL(SB).hostname.split(".")[0];
  const tokenObj = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: "bearer",
    user: session.user,
  };
  const value = "base64-" + Buffer.from(JSON.stringify(tokenObj)).toString("base64url");
  return `sb-${projectRef}-auth-token=${value}`;
}

const restGet = (path) => fetch(`${SB}/rest/v1/${path}`, {
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}` }
}).then((r) => r.json());

const restDel = (path) => fetch(`${SB}/rest/v1/${path}`, {
  method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, Prefer: "return=minimal" }
});

async function main() {
  // ── 1. Admin signs up + completes onboarding ────────────────────────────
  step(1, "Admin completes onboarding");
  const adminEmail = `admin-${Date.now()}@flow-test.local`;
  const admin = await adminCreate(adminEmail, "TestPass!123Strong", "admin");
  const adminSession = await signIn(adminEmail, "TestPass!123Strong");
  const adminCookie = cookieFor(adminSession);
  ok(`admin user: ${adminEmail} (${admin.id})`);

  const finalizeRes = await fetch(`${APP}/api/onboarding/finalize`, {
    method: "POST", headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({
      state: {
        information: {
          practice_name: PRACTICE_NAME,
          description: "Family medicine practice in Austin.",
          employee_range: "21-50",
          location_count_range: "1-2",
          locations: [{ label: "Main", street_1: "100 Test", street_2: "", city: "Austin", region: "TX", postal_code: "78701" }],
        },
        fortification: { current_status: "starting_brand_new", upcoming_audit_window: "within_90_days" },
        safeguards: { mode: "manual", integrations: ["microsoft_365"], assistance_date: "", assistance_window: "", assistance_phone: "", assistance_notes: "" },
        payment: { selected_plan: "practice" },
      },
      existing_practice_id: null,
    }),
  });
  const fb = await finalizeRes.json();
  if (!finalizeRes.ok || !fb.ok) { fail(`finalize: ${finalizeRes.status} ${JSON.stringify(fb)}`); return; }
  created.practiceId = fb.practice_id;
  ok(`practice created: ${PRACTICE_NAME} (${created.practiceId})`);

  // ── 2. Standard-A submits join request (matching name) ──────────────────
  step(2, "Standard-A requests to join (matching practice name)");
  const sAEmail = `standard-a-${Date.now()}@flow-test.local`;
  const sA = await adminCreate(sAEmail, "TestPass!123Strong", "employee");
  const sASession = await signIn(sAEmail, "TestPass!123Strong");
  const sACookie = cookieFor(sASession);

  const sAEmpRes = await fetch(`${APP}/api/onboarding/employee`, {
    method: "POST", headers: { cookie: sACookie, "content-type": "application/json" },
    body: JSON.stringify({
      full_name: "Jane Doe",
      job_title: "Office Manager",
      phone: "555-123-4567",
      pending_practice_name: PRACTICE_NAME,
      claimed_admin_name: "Practice Admin",
      primary_address: { street_1: "100 Test", street_2: null, city: "Austin", region: "TX", postal_code: "78701" },
    }),
  });
  const sAB = await sAEmpRes.json();
  if (!sAEmpRes.ok || !sAB.ok) { fail(`Standard-A submit: ${sAEmpRes.status} ${JSON.stringify(sAB)}`); return; }
  ok(`Standard-A submitted (matched=${sAB.matched})`);
  if (sAB.matched !== true) fail("expected matched=true for exact name");

  // ── 3. Verify Standard-A row state ──────────────────────────────────────
  step(3, "Verify Standard-A is pending + admin received notification");
  const sAProfile = await restGet(`user_profiles?user_id=eq.${sA.id}&select=status,matched_practice_id,full_name,claimed_admin_name`);
  if (sAProfile[0]?.status !== "pending") fail(`status: ${sAProfile[0]?.status}`);
  else ok(`profile.status = pending`);
  if (sAProfile[0]?.matched_practice_id !== created.practiceId) fail(`matched_practice_id mismatch`);
  else ok(`matched_practice_id linked to admin's practice`);

  const adminNotifs = await restGet(`notifications?user_id=eq.${admin.id}&kind=eq.request.created&select=title,body,link`);
  if (adminNotifs.length === 0) fail(`admin received 0 notifications`);
  else ok(`admin got "${adminNotifs[0].title}" notification → ${adminNotifs[0].link}`);

  // ── 4. Admin approves Standard-A ────────────────────────────────────────
  step(4, "Admin approves Standard-A as 'staff'");
  const approveRes = await fetch(`${APP}/api/team/requests/${sA.id}`, {
    method: "POST", headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ action: "approve", role: "staff" }),
  });
  const apprB = await approveRes.json();
  if (!approveRes.ok || apprB.status !== "approved") { fail(`approve: ${approveRes.status} ${JSON.stringify(apprB)}`); return; }
  ok(`approve → ${apprB.status}`);

  const sAProfile2 = await restGet(`user_profiles?user_id=eq.${sA.id}&select=status,decided_by,decided_at`);
  if (sAProfile2[0]?.status !== "approved") fail(`status not approved: ${sAProfile2[0]?.status}`);
  else ok(`profile.status flipped to approved (decided_by ${sAProfile2[0].decided_by === admin.id ? "matches admin ✓" : "MISMATCH"})`);

  const sAMembership = await restGet(`practice_users?user_id=eq.${sA.id}&practice_id=eq.${created.practiceId}&select=role`);
  if (sAMembership[0]?.role !== "staff") fail(`membership role: ${sAMembership[0]?.role}`);
  else ok(`practice_users row created with role=staff`);

  const sANotifs = await restGet(`notifications?user_id=eq.${sA.id}&kind=eq.request.approved&select=title,link`);
  if (sANotifs.length === 0) fail(`Standard-A did not receive approval notification`);
  else ok(`Standard-A notified "${sANotifs[0].title}" → ${sANotifs[0].link}`);

  // Approved standard signs in and hits /app — should NOT redirect to /pending
  step(4.5, "Approved Standard-A loads /app");
  const sANewSession = await signIn(sAEmail, "TestPass!123Strong");
  const sANewCookie = cookieFor(sANewSession);
  const appRes = await fetch(`${APP}/app`, { headers: { cookie: sANewCookie }, redirect: "manual" });
  if (appRes.status === 200) ok(`GET /app → 200 (sees DashboardEmployee)`);
  else if (appRes.status === 307) fail(`GET /app → 307 redirect (should be 200 for approved user). Location: ${appRes.headers.get("location")}`);
  else fail(`GET /app → unexpected ${appRes.status}`);

  // ── 5. Standard-B submits + admin denies ────────────────────────────────
  step(5, "Standard-B submits, admin denies with reason");
  const sBEmail = `standard-b-${Date.now()}@flow-test.local`;
  const sB = await adminCreate(sBEmail, "TestPass!123Strong", "employee");
  const sBSession = await signIn(sBEmail, "TestPass!123Strong");
  const sBCookie = cookieFor(sBSession);

  await fetch(`${APP}/api/onboarding/employee`, {
    method: "POST", headers: { cookie: sBCookie, "content-type": "application/json" },
    body: JSON.stringify({
      full_name: "John Imposter",
      job_title: "Janitor",
      phone: null,
      pending_practice_name: PRACTICE_NAME,
      claimed_admin_name: "Fake Admin",
      primary_address: { street_1: "999 Wrong", street_2: null, city: "Austin", region: "TX", postal_code: "78701" },
    }),
  });

  const denyRes = await fetch(`${APP}/api/team/requests/${sB.id}`, {
    method: "POST", headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ action: "deny", denial_reason: "We don't recognize you on our team." }),
  });
  const denB = await denyRes.json();
  if (!denyRes.ok || denB.status !== "denied") { fail(`deny: ${denyRes.status} ${JSON.stringify(denB)}`); }
  else ok(`deny → ${denB.status}`);

  const sBProfile = await restGet(`user_profiles?user_id=eq.${sB.id}&select=status,denial_reason`);
  if (sBProfile[0]?.status !== "denied") fail(`status not denied: ${sBProfile[0]?.status}`);
  else ok(`profile.status = denied, reason recorded`);
  if (sBProfile[0]?.denial_reason !== "We don't recognize you on our team.") fail(`reason mismatch: ${sBProfile[0]?.denial_reason}`);

  const sBNotifs = await restGet(`notifications?user_id=eq.${sB.id}&kind=eq.request.denied&select=title,link`);
  if (sBNotifs.length === 0) fail(`Standard-B did not receive denial notification`);
  else ok(`Standard-B notified "${sBNotifs[0].title}" → ${sBNotifs[0].link}`);

  // Standard-B sign in → /app → should redirect to /denied
  const sBNew = await signIn(sBEmail, "TestPass!123Strong");
  const sBNewCookie = cookieFor(sBNew);
  const sBAppRes = await fetch(`${APP}/app`, { headers: { cookie: sBNewCookie }, redirect: "manual" });
  if (sBAppRes.status === 307 && sBAppRes.headers.get("location")?.includes("/denied")) {
    ok(`denied Standard-B hits /app → redirects to /denied`);
  } else fail(`denied user routing: ${sBAppRes.status} → ${sBAppRes.headers.get("location")}`);

  // ── 6. Standard-C: non-matching practice name ───────────────────────────
  step(6, "Standard-C submits non-matching practice name");
  const sCEmail = `standard-c-${Date.now()}@flow-test.local`;
  const sC = await adminCreate(sCEmail, "TestPass!123Strong", "employee");
  const sCSession = await signIn(sCEmail, "TestPass!123Strong");
  const sCCookie = cookieFor(sCSession);

  const sCRes = await fetch(`${APP}/api/onboarding/employee`, {
    method: "POST", headers: { cookie: sCCookie, "content-type": "application/json" },
    body: JSON.stringify({
      full_name: "Jane NoMatch",
      job_title: "Tech",
      phone: null,
      pending_practice_name: "Nonexistent Practice " + Date.now(),
      claimed_admin_name: "Anyone",
      primary_address: { street_1: "1", street_2: null, city: "Nowhere", region: "XX", postal_code: "00000" },
    }),
  });
  const sCB = await sCRes.json();
  if (sCB.matched !== false) fail(`expected matched=false, got ${sCB.matched}`);
  else ok(`unmatched submission stored (matched=false)`);

  const sCProfile = await restGet(`user_profiles?user_id=eq.${sC.id}&select=status,matched_practice_id`);
  if (sCProfile[0]?.status !== "pending") fail(`status: ${sCProfile[0]?.status}`);
  if (sCProfile[0]?.matched_practice_id !== null) fail(`matched_practice_id should be null`);
  else ok(`profile.status = pending, matched_practice_id = null`);

  // Standard-C sign in → /app → should redirect to /pending
  const sCNew = await signIn(sCEmail, "TestPass!123Strong");
  const sCNewCookie = cookieFor(sCNew);
  const sCAppRes = await fetch(`${APP}/app`, { headers: { cookie: sCNewCookie }, redirect: "manual" });
  if (sCAppRes.status === 307 && sCAppRes.headers.get("location")?.includes("/pending")) {
    ok(`unmatched Standard-C hits /app → redirects to /pending`);
  } else fail(`unmatched user routing: ${sCAppRes.status} → ${sCAppRes.headers.get("location")}`);

  // ── 7. Notifications API end-to-end ─────────────────────────────────────
  step(7, "Notifications API as admin (GET + mark all read)");
  const adminNotifResG = await fetch(`${APP}/api/notifications`, { headers: { cookie: adminCookie } });
  const notifData = await adminNotifResG.json();
  if (!adminNotifResG.ok) { fail(`notifications GET: ${adminNotifResG.status} ${JSON.stringify(notifData)}`); }
  else ok(`GET /api/notifications → ${notifData.items.length} items, ${notifData.unread} unread`);

  const markRes = await fetch(`${APP}/api/notifications`, {
    method: "POST", headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ mark_all_read: true }),
  });
  if (!markRes.ok) fail(`mark all read failed`);
  else {
    const re = await fetch(`${APP}/api/notifications`, { headers: { cookie: adminCookie } });
    const reD = await re.json();
    if (reD.unread === 0) ok(`mark_all_read → unread now 0`);
    else fail(`unread after mark: ${reD.unread}`);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  step(8, "Cleanup");
  if (created.practiceId) await restDel(`practices?id=eq.${created.practiceId}`);
  for (const id of created.users) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  }
  ok(`practice + ${created.users.length} users deleted`);

  console.log(`\n${process.exitCode ? C.r + "━━ TEST FAILED ━━" : C.g + "━━ ALL FLOWS PASSED ━━"}${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  if (created.practiceId) await restDel(`practices?id=eq.${created.practiceId}`);
  for (const id of created.users) {
    await fetch(`${SB}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } }).catch(() => {});
  }
});
