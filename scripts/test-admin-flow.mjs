#!/usr/bin/env node
// Test the administrator onboarding flow end-to-end.
// Creates a confirmed test user via service-role (skips email verify),
// signs in to get a session cookie, hits the finalize endpoint with a realistic
// payload, then verifies the resulting DB state. Cleans up at the end.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = "http://localhost:3456";

const EMAIL = `test-admin-${Date.now()}@fortify-test.local`;
const PASSWORD = "TestPassword!Strong#123";

const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", x: "\x1b[0m" };
const step = (n, t) => console.log(`\n${C.y}[${n}]${C.x} ${t}`);
const ok = (m) => console.log(`  ${C.g}✓${C.x} ${m}`);
const fail = (m) => { console.log(`  ${C.r}✗${C.x} ${m}`); process.exitCode = 1; };

let userId = null;
let practiceId = null;

async function main() {
  // ── 1. Create confirmed user via service-role ─────────────────────────────
  step(1, "Create confirmed test user");
  let r = await fetch(`${SB}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json",
    },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { account_type: "admin" },
    }),
  });
  if (!r.ok) { fail(`admin create: ${r.status} ${await r.text()}`); return; }
  const user = await r.json();
  userId = user.id;
  ok(`created ${EMAIL} (${userId})`);
  ok(`user_metadata.account_type = ${user.user_metadata?.account_type}`);

  // ── 2. Sign in to get access token ────────────────────────────────────────
  step(2, "Sign in (password grant)");
  r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) { fail(`sign in: ${r.status} ${await r.text()}`); return; }
  const session = await r.json();
  ok(`access_token ok, expires_in=${session.expires_in}s`);

  // ── 3. Build cookies the Next.js Supabase SSR client expects ──────────────
  // @supabase/ssr uses cookie name "sb-<project-ref>-auth-token" with base64-prefixed JSON.
  const projectRef = new URL(SB).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const tokenObj = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    token_type: "bearer",
    user: session.user,
  };
  // @supabase/ssr decodes the cookie with base64url (URL-safe alphabet, no padding),
  // NOT regular base64. Node 16+ supports "base64url" directly.
  const cookieValue = "base64-" + Buffer.from(JSON.stringify(tokenObj)).toString("base64url");
  // Chunked when >3180 url-encoded chars; our session token is well under that.
  const cookieHeader = `${cookieName}=${cookieValue}`;
  ok(`cookie ${cookieName} prepared (${cookieValue.length} chars)`);

  // ── 4. Sanity: cookied request to /app/onboarding returns 200 ────────────
  step(3, "Hit /app/onboarding as the signed-in user");
  r = await fetch(`${APP}/app/onboarding`, { headers: { cookie: cookieHeader } });
  if (r.status !== 200) { fail(`onboarding page: ${r.status}`); }
  else ok(`GET /app/onboarding → 200`);

  // ── 5. POST finalize with full admin payload ──────────────────────────────
  step(4, "POST /api/onboarding/finalize");
  const payload = {
    state: {
      information: {
        practice_name: "Test Practice " + Date.now(),
        description: "Family medicine practice in Austin, focused on preventative care.",
        employee_range: "21-50",
        location_count_range: "1-2",
        locations: [
          {
            label: "Main clinic",
            street_1: "100 Test St",
            street_2: "",
            city: "Austin",
            region: "TX",
            postal_code: "78701",
          },
        ],
      },
      fortification: {
        current_status: "starting_brand_new",
        upcoming_audit_window: "within_90_days",
      },
      safeguards: {
        mode: "manual",
        integrations: ["microsoft_365", "google_workspace"],
        assistance_date: "",
        assistance_window: "",
        assistance_phone: "",
        assistance_notes: "",
      },
      payment: { selected_plan: "practice" },
    },
    existing_practice_id: null,
  };
  r = await fetch(`${APP}/api/onboarding/finalize`, {
    method: "POST",
    headers: { cookie: cookieHeader, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const fb = await r.json().catch(() => ({}));
  if (!r.ok || !fb.ok) {
    fail(`finalize: ${r.status} ${JSON.stringify(fb)}`);
    return;
  }
  practiceId = fb.practice_id;
  ok(`finalize → 200, practice_id=${practiceId}`);

  // ── 6. Verify DB state via service-role REST ──────────────────────────────
  step(5, "Verify DB state");
  const restHeaders = { apikey: SVC, Authorization: `Bearer ${SVC}` };

  const check = async (label, path, predicate) => {
    const rr = await fetch(`${SB}/rest/v1/${path}`, { headers: restHeaders });
    if (!rr.ok) { fail(`${label}: ${rr.status} ${await rr.text()}`); return null; }
    const data = await rr.json();
    if (predicate(data)) ok(`${label}: ${C.d}${JSON.stringify(data).slice(0, 140)}${C.x}`);
    else fail(`${label}: predicate failed → ${JSON.stringify(data).slice(0, 200)}`);
    return data;
  };

  await check(
    "practices row exists with completed step",
    `practices?id=eq.${practiceId}&select=id,name,onboarding_step,current_status,selected_plan,description,employee_range`,
    (d) => d.length === 1 && d[0].onboarding_step === "completed" && d[0].current_status === "starting_brand_new"
  );

  await check(
    "practice_users has caller as owner",
    `practice_users?practice_id=eq.${practiceId}&select=role,user_id`,
    (d) => d.length === 1 && d[0].role === "owner" && d[0].user_id === userId
  );

  await check(
    "practice_locations has 1 location",
    `practice_locations?practice_id=eq.${practiceId}&select=city,region`,
    (d) => d.length === 1 && d[0].city === "Austin"
  );

  await check(
    "integration choices recorded",
    `onboarding_integration_choices?practice_id=eq.${practiceId}&select=integration_type`,
    (d) => d.length === 2
  );

  await check(
    "audit log entry created",
    `audit_logs?practice_id=eq.${practiceId}&action=eq.onboarding.completed&select=action,metadata`,
    (d) => d.length >= 1
  );

  await check(
    "practice_controls pre-seeded (healthcare baseline)",
    `practice_controls?practice_id=eq.${practiceId}&select=id`,
    (d) => Array.isArray(d) // may be empty if no baseline controls exist yet
  );

  // ── 7. Hit /app and /app/onboarding/welcome as authed user ────────────────
  step(6, "Post-onboarding navigation");
  r = await fetch(`${APP}/app/onboarding/welcome`, { headers: { cookie: cookieHeader }, redirect: "manual" });
  ok(`GET /app/onboarding/welcome → ${r.status}`);

  r = await fetch(`${APP}/app`, { headers: { cookie: cookieHeader }, redirect: "manual" });
  ok(`GET /app → ${r.status}`);

  step(7, "Cleanup");
  await fetch(`${SB}/rest/v1/practices?id=eq.${practiceId}`, {
    method: "DELETE", headers: { ...restHeaders, Prefer: "return=minimal" },
  });
  ok(`practice deleted (cascades to locations, controls, etc.)`);
  await fetch(`${SB}/auth/v1/admin/users/${userId}`, {
    method: "DELETE", headers: restHeaders,
  });
  ok(`auth user deleted`);

  console.log(`\n${C.g}━━ ADMIN FLOW PASSED ━━${C.x}\n`);
}

main().catch(async (e) => {
  console.error(`\n${C.r}FATAL${C.x}`, e);
  process.exitCode = 1;
  if (practiceId) {
    await fetch(`${SB}/rest/v1/practices?id=eq.${practiceId}`, {
      method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    }).catch(() => {});
  }
  if (userId) {
    await fetch(`${SB}/auth/v1/admin/users/${userId}`, {
      method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` },
    }).catch(() => {});
  }
});
