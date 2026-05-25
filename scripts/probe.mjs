import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = `probe-${Date.now()}@fortify-test.local`;
const PASSWORD = "Probe!Strong#123";
let r = await fetch(`${SB}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true })
});
const u = await r.json();

r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD })
});
const s = await r.json();

// Probe 1: PostgREST select with user's JWT — does auth.uid() show up?
r = await fetch(`${SB}/rest/v1/rpc/`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "content-type": "application/json" }
});
console.log("rpc base:", r.status);

// Probe 2: try inserting into practices directly with user JWT
r = await fetch(`${SB}/rest/v1/practices`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`,
    "content-type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({ name: "probe", hipaa_covered_entity: true, frameworks_enabled: ["HIPAA"] })
});
console.log("direct insert via PostgREST:", r.status, await r.text());

// cleanup
await fetch(`${SB}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
