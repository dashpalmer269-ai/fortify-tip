/**
 * Fortify production E2E probe (run after any deploy):
 *   npm run test:e2e-prod
 * Needs .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY. Creates a disposable user + practice in PROD,
 * drives every screen and mutation with a real session cookie, then tears
 * everything down via the practice-delete path (verified in the checks).
 *
 * Fortify production E2E driver.
 * Creates a disposable user + practice, drives the real product over HTTP
 * with a real session cookie, checks every screen + key mutations, then
 * tears everything down via the practice-delete path.
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envFile.split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const REF = new URL(SUPA).hostname.split(".")[0];
const SITE = "https://fortifynow.xyz";

const results = [];
function log(status, name, detail = "") {
  results.push({ status, name, detail });
  console.log(`${status === "PASS" ? "✅" : status === "WARN" ? "⚠️ " : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

// ── Supabase REST helpers ──────────────────────────────────────────────────
async function sadmin(path, opts = {}) {
  const res = await fetch(`${SUPA}${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json", ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

// ── Session cookie construction (mirrors @supabase/ssr) ───────────────────
function b64url(s) {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function sessionCookies(session) {
  const value = "base64-" + b64url(JSON.stringify(session));
  const name = `sb-${REF}-auth-token`;
  const MAX = 3180;
  if (value.length <= MAX) return [`${name}=${value}`];
  const out = [];
  for (let i = 0; i * MAX < value.length; i++) out.push(`${name}.${i}=${value.slice(i * MAX, (i + 1) * MAX)}`);
  return out;
}

let COOKIE = "";

// ── Site fetch helpers ─────────────────────────────────────────────────────
async function page(path, { maxHops = 8 } = {}) {
  const chain = [];
  let url = `${SITE}${path}`;
  const t0 = Date.now();
  for (let hop = 0; hop < maxHops; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { Cookie: COOKIE, "User-Agent": "fortify-e2e" },
      signal: AbortSignal.timeout(90_000),
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      const nextUrl = new URL(loc, url).toString();
      chain.push(`${res.status}→${new URL(nextUrl).pathname}${new URL(nextUrl).search}`);
      if (chain.length >= 2 && chain[chain.length - 1] === chain[chain.length - 2]) {
        return { loop: true, chain, ms: Date.now() - t0, status: res.status, finalPath: new URL(nextUrl).pathname };
      }
      url = nextUrl;
      continue;
    }
    const text = await res.text();
    const u = new URL(url);
    return { loop: false, chain, status: res.status, ms: Date.now() - t0, finalPath: u.pathname + u.search, body: text };
  }
  return { loop: true, chain, ms: Date.now() - t0, status: 0, finalPath: "(max hops)" };
}

async function api(method, path, body) {
  const res = await fetch(`${SITE}${path}`, {
    method,
    headers: { Cookie: COOKIE, "Content-Type": "application/json", "User-Agent": "fortify-e2e" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/pdf")) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, pdf: buf };
  }
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}

const ERROR_MARKERS = /Application error|Internal Server Error|__next_error__|Unhandled Runtime|FUNCTION_INVOCATION/i;

// ── The run ────────────────────────────────────────────────────────────────
const stamp = Date.now().toString(36);
const EMAIL = `e2e-probe-${stamp}@fortify-e2e-test.example.com`;
const PASSWORD = "E2e!" + randomBytes(12).toString("base64url");
const PRACTICE_NAME = "E2E Probe Practice";
let userId = null, practiceId = null;

async function main() {
  // 1. Create confirmed user (bypasses signup rate limit + email confirm)
  const cu = await sadmin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { account_type: "admin" } }),
  });
  if (cu.status !== 200 && cu.status !== 201) { log("FAIL", "create test user", JSON.stringify(cu.body).slice(0, 150)); return; }
  userId = cu.body.id;
  log("PASS", "create test user", EMAIL);

  // 2. Password sign-in → session
  const tok = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const session = await tok.json();
  if (!session.access_token) { log("FAIL", "password sign-in", JSON.stringify(session).slice(0, 150)); return; }
  COOKIE = sessionCookies(session).join("; ");
  log("PASS", "password sign-in → session cookie", `${COOKIE.length} chars, ${sessionCookies(session).length} chunk(s)`);

  // 3. THE LOOP TEST: /app/onboarding with no practice
  const ob = await page("/app/onboarding");
  if (ob.loop) log("FAIL", "onboarding page (no practice)", `REDIRECT LOOP: ${ob.chain.join(" ")}`);
  else if (ob.status === 200 && ob.finalPath.startsWith("/app/onboarding")) log("PASS", "onboarding page renders (no practice)", `${ob.ms}ms chain=[${ob.chain.join(" ")}]`);
  else log("FAIL", "onboarding page (no practice)", `status=${ob.status} final=${ob.finalPath} chain=[${ob.chain.join(" ")}]`);

  // Also: /app with no practice should land on onboarding, not loop
  const appNoPractice = await page("/app");
  log(appNoPractice.loop ? "FAIL" : appNoPractice.finalPath.startsWith("/app/onboarding") && appNoPractice.status === 200 ? "PASS" : "WARN",
    "/app (no practice) routes to onboarding", `final=${appNoPractice.finalPath} status=${appNoPractice.status} ${appNoPractice.loop ? "LOOP " + appNoPractice.chain.join(" ") : ""}`);

  // 4. Finalize onboarding (self-serve, NO invite code)
  const fin = await api("POST", "/api/onboarding/finalize", {
    state: {
      information: {
        practice_name: PRACTICE_NAME,
        description: "Disposable practice created by the automated E2E probe.",
        employee_range: "1-20",
        location_count_range: "1-2",
        locations: [{ label: "Main", street_1: "100 Test Way", street_2: null, city: "Austin", region: "TX", postal_code: "78701" }],
      },
      fortification: { current_status: "starting_brand_new", upcoming_audit_window: "beyond_90_days" },
      safeguards: { mode: "manual", integrations: [], assistance_date: "", assistance_window: "", assistance_phone: "", assistance_notes: "" },
      payment: { selected_plan: "software" },
    },
    existing_practice_id: null,
  });
  if (fin.status !== 200 || !fin.body?.practice_id) { log("FAIL", "onboarding finalize", `status=${fin.status} ${JSON.stringify(fin.body).slice(0, 200)}`); return; }
  practiceId = fin.body.practice_id;
  log("PASS", "onboarding finalize creates practice", `${practiceId} demo_minutes=${fin.body.demo_minutes}`);

  // 5. Fresh practice, no invite → where does /app land?
  const appUnpaid = await page("/app");
  log(!appUnpaid.loop && appUnpaid.finalPath.includes("activate=1") ? "PASS" : "FAIL", "self-serve funnel → /pricing?activate=1 welcome", `final=${appUnpaid.finalPath} status=${appUnpaid.status}${appUnpaid.loop ? " LOOP!" : ""}`);

  // 6. Grant demo access (simulates redeemed demo invite) so the app surface can be tested
  const grant = await sadmin(`/rest/v1/practices?id=eq.${practiceId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ plan_source: "invite", access_expires_at: new Date(Date.now() + 2 * 3600_000).toISOString() }),
  });
  log(grant.status === 204 ? "PASS" : "FAIL", "grant demo access to test practice", `status=${grant.status}`);

  // 7. Every app screen
  const screens = ["/app", "/app/setup", "/app/compliance", "/app/coverage", "/app/risk-assessment",
    "/app/risk-assessment/new", "/app/policies", "/app/training", "/app/vendors", "/app/reports",
    "/app/attestations", "/app/audit-log", "/app/team", "/app/integrations", "/app/billing",
    "/app/settings", "/app/help", "/app/onboarding/welcome"];
  for (const s of screens) {
    const r = await page(s);
    const bad = r.loop || r.status !== 200 || ERROR_MARKERS.test(r.body ?? "");
    const slow = r.ms > 8000;
    log(bad ? "FAIL" : slow ? "WARN" : "PASS", `screen ${s}`,
      `${r.status} ${r.ms}ms${r.finalPath !== s ? " → " + r.finalPath : ""}${r.loop ? " LOOP " + r.chain.join(" ") : ""}${ERROR_MARKERS.test(r.body ?? "") ? " ERROR-MARKER" : ""}`);
  }

  // 8. API mutations
  const t1 = await api("POST", "/api/tasks", { title: "E2E probe task", severity: "low" });
  const taskId = t1.body?.task?.id ?? t1.body?.id;
  log([200,201].includes(t1.status) && taskId ? "PASS" : "FAIL", "task create", `status=${t1.status} id=${taskId ?? "?"} ${taskId ? "" : JSON.stringify(t1.body).slice(0, 120)}`);
  if (taskId) {
    const t2 = await api("POST", `/api/tasks/${taskId}`, { notes: "edited by e2e" });
    log(t2.status === 200 ? "PASS" : "FAIL", "task non-status edit (task.edited audit)", `status=${t2.status}`);
    const t3 = await api("POST", `/api/tasks/${taskId}`, { status: "done" });
    log(t3.status === 200 ? "PASS" : "FAIL", "task complete", `status=${t3.status}`);
  }

  // Team invite → delivered@resend.dev (live Resend + domain proof)
  const inv = await api("POST", "/api/invites/queue", { practice_id: practiceId, invites: [{ email: "delivered@resend.dev", role: "staff" }] });
  const sent = inv.status === 200 && inv.body?.queued === 1;
  log(sent ? "PASS" : "FAIL", "team invite email via Resend (LIVE SEND)", `status=${inv.status} queued=${inv.body?.queued} skipped=${JSON.stringify(inv.body?.skipped ?? [])}`);

  // Tenant isolation: same call against a FOREIGN practice must 403
  const foreign = await api("POST", "/api/invites/queue", { practice_id: "5223e014-4177-4c01-b6cf-9d0121282b60", invites: [{ email: "delivered@resend.dev", role: "staff" }] });
  log(foreign.status === 403 ? "PASS" : "FAIL", "tenant isolation (foreign practice invite → 403)", `status=${foreign.status}`);

  // Evidence: manual attestation on a real evidence check of this practice
  const ec = await sadmin(`/rest/v1/evidence_checks?select=id,check_key,collection_method&collection_method=eq.manual_attestation&limit=1`);
  if (ec.body?.[0]) {
    const att = await api("POST", "/api/evidence/attest", { evidence_check_id: ec.body[0].id, statement: "Verified by automated E2E probe." });
    log(att.status === 200 ? "PASS" : "FAIL", "evidence manual attestation flow", `status=${att.status} check=${ec.body[0].check_key} ${att.status !== 200 ? JSON.stringify(att.body).slice(0, 120) : ""}`);
  } else log("WARN", "evidence manual attestation flow", "no manual_attestation checks defined");

  // PHI gate: a note containing PHI-looking content must be rejected 422
  const phi = await api("POST", "/api/tasks", { title: "Follow up patient", notes: "Patient SSN 123-45-6789 seen for diagnosis" });
  log(phi.status === 422 ? "PASS" : "FAIL", "NO-PHI gate rejects PHI in task notes (422)", `status=${phi.status}`);

  // Attestation: generate → sign → PDF
  const ag = await api("POST", "/api/attestations", { type: "hipaa_sra" });
  const attId = ag.body?.attestation?.id ?? ag.body?.id;
  log([200,201].includes(ag.status) && attId ? "PASS" : "FAIL", "attestation generate (HIPAA SRA)", `status=${ag.status} id=${attId ?? JSON.stringify(ag.body).slice(0, 150)}`);
  if (attId) {
    const sg = await api("POST", `/api/attestations/${attId}/sign`, { method: "e_signature", signer_name: "E2E Probe", signer_title: "Automated Test", affirmed: true });
    log(sg.status === 200 ? "PASS" : "FAIL", "attestation e-sign", `status=${sg.status} ${sg.status !== 200 ? JSON.stringify(sg.body).slice(0, 120) : ""}`);
    const pdf = await api("GET", `/api/attestations/${attId}/pdf`);
    const okPdf = pdf.status === 200 && pdf.pdf && pdf.pdf.subarray(0, 5).toString() === "%PDF-";
    log(okPdf ? "PASS" : "FAIL", "attestation PDF download", `status=${pdf.status} bytes=${pdf.pdf?.length ?? 0}`);
  }

  // Report: generate (1 Opus call) → PDF
  const rg = await api("POST", "/api/reports/generate", { practice_id: practiceId });
  const repId = rg.body?.report?.id ?? rg.body?.id ?? rg.body?.report_id;
  log(rg.status === 200 && repId ? "PASS" : "FAIL", "report generate (AI summary)", `status=${rg.status} id=${repId ?? JSON.stringify(rg.body).slice(0, 150)}`);
  if (repId) {
    const rpdf = await api("GET", `/api/reports/${repId}/pdf`);
    const okPdf = rpdf.status === 200 && rpdf.pdf && rpdf.pdf.subarray(0, 5).toString() === "%PDF-";
    log(okPdf ? "PASS" : "FAIL", "report PDF download", `status=${rpdf.status} bytes=${rpdf.pdf?.length ?? 0}`);
  }

  // Policy: generate (1 Opus call) → acknowledge
  const pg = await api("POST", "/api/policies/generate", { practice_id: practiceId, policy_type: "access_control", title: "Access Control Policy" });
  const polId = pg.body?.policy?.id ?? pg.body?.id;
  log(pg.status === 200 && polId ? "PASS" : "FAIL", "policy generate (AI draft)", `status=${pg.status} id=${polId ?? JSON.stringify(pg.body).slice(0, 150)}`);
  if (polId) {
    const act = await api("POST", `/api/policies/${polId}/activate`);
    log(act.status === 200 ? "PASS" : "FAIL", "policy activate (draft → active)", `status=${act.status} ${act.status !== 200 ? JSON.stringify(act.body).slice(0, 120) : ""}`);
    const ack = await api("POST", `/api/policies/${polId}/acknowledge`);
    log(ack.status === 200 ? "PASS" : "FAIL", "policy acknowledge (RPC)", `status=${ack.status} ${ack.status !== 200 ? JSON.stringify(ack.body).slice(0, 120) : ""}`);
  }

  // Training: complete first active module
  const tm = await sadmin(`/rest/v1/training_modules?select=id,title&active=eq.true&limit=1`);
  if (tm.body?.[0]) {
    const tc = await api("POST", `/api/training/${tm.body[0].id}/complete`, {});
    log(tc.status === 200 ? "PASS" : "FAIL", "training completion", `status=${tc.status} module=${tm.body[0].title} ${tc.status !== 200 ? JSON.stringify(tc.body).slice(0, 120) : ""}`);
  } else log("WARN", "training completion", "no active modules");

  // Screening: preliminary self-screen (fake name unlikely to hit LEIE)
  const sc = await api("POST", "/api/screening/preliminary", { subject_type: "workforce_member", practice_id: practiceId, first_name: "Zebulon", last_name: "Proberton", date_of_birth: "1990-01-01" });
  log([200,201].includes(sc.status) ? "PASS" : sc.status === 503 ? "WARN" : "FAIL", "exclusion screening preliminary", `status=${sc.status} ${JSON.stringify(sc.body).slice(0, 140)}`);

  // Notifications: list + mark read
  const nl = await api("GET", "/api/notifications");
  log(nl.status === 200 ? "PASS" : "FAIL", "notifications list", `status=${nl.status} ok`);
  const nm = await api("POST", "/api/notifications", { mark_all_read: true });
  log(nm.status === 200 ? "PASS" : "FAIL", "notifications mark-all-read", `status=${nm.status}`);

  // Billing checkout while unconfigured → clean failure
  const co = await api("POST", "/api/billing/checkout", { plan_id: "software" });
  log(co.status >= 400 && (co.body?.error || co.body?.next_step) ? "PASS" : "FAIL",
    "billing checkout unconfigured → clean error", `status=${co.status} ${JSON.stringify(co.body).slice(0, 140)}`);

  // Integration disconnect with nothing connected → clean 404
  const dc = await api("POST", "/api/integrations/disconnect", { integration_type: "aws" });
  log(dc.status === 404 ? "PASS" : "FAIL", "integration disconnect (none connected) → 404", `status=${dc.status}`);

  // Rate limit: AI route per-practice bucket (2nd+ report calls should still be within 10/10min — probe headers only)
  // (skipped active exhaustion — would burn Opus calls)

  // 9. Teardown: revoke the pending invite (exercises revoke), then practice delete
  const invRow = await sadmin(`/rest/v1/practice_invites?select=id&practice_id=eq.${practiceId}&status=eq.pending&limit=1`);
  if (invRow.body?.[0]) {
    const rv = await api("POST", `/api/invites/${invRow.body[0].id}/revoke`);
    log(rv.status === 200 ? "PASS" : "FAIL", "team invite revoke", `status=${rv.status}`);
  }

  const del = await api("POST", "/api/practice/delete", { practice_id: practiceId, confirm_name: PRACTICE_NAME });
  log(del.status === 200 ? "PASS" : "FAIL", "practice delete (owner, confirm-name)", `status=${del.status} ${del.status !== 200 ? JSON.stringify(del.body).slice(0, 140) : ""}`);

  // Verify cascade + platform audit
  const gone = await sadmin(`/rest/v1/practices?select=id&id=eq.${practiceId}`);
  log(Array.isArray(gone.body) && gone.body.length === 0 ? "PASS" : "FAIL", "practice row cascaded away");
  const invGone = await sadmin(`/rest/v1/practice_invites?select=id&practice_id=eq.${practiceId}`);
  log(Array.isArray(invGone.body) && invGone.body.length === 0 ? "PASS" : "FAIL", "practice_invites cascaded away");
  const paudit = await sadmin(`/rest/v1/platform_audit_logs?select=event,practice_name&practice_id=eq.${practiceId}&event=eq.practice.deleted`);
  log(paudit.body?.[0] ? "PASS" : "FAIL", "platform audit row survives deletion", JSON.stringify(paudit.body?.[0] ?? {}));
}

async function teardown() {
  try {
    if (practiceId) {
      const still = await sadmin(`/rest/v1/practices?select=id&id=eq.${practiceId}`);
      if (Array.isArray(still.body) && still.body.length > 0) {
        await sadmin(`/rest/v1/practices?id=eq.${practiceId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
        console.log("🧹 force-deleted leftover practice");
      }
    }
    if (userId) {
      const du = await sadmin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
      console.log(`🧹 deleted test user (${du.status})`);
    }
  } catch (e) { console.log("teardown error", e.message); }
}

main()
  .catch((e) => log("FAIL", "driver crashed", e.stack?.slice(0, 300) ?? String(e)))
  .finally(async () => {
    await teardown();
    const fails = results.filter((r) => r.status === "FAIL").length;
    const warns = results.filter((r) => r.status === "WARN").length;
    console.log(`\n══ SUMMARY: ${results.length} checks · ${fails} FAIL · ${warns} WARN ══`);
    process.exit(fails > 0 ? 1 : 0);
  });
