#!/usr/bin/env node
// Probe: does auth.uid() return the user ID when calling PostgREST with the
// user's JWT? If null, our session/JWT setup is wrong. If correct, RLS is wrong.

import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = `probe-uid-${Date.now()}@fortify-test.local`;
const PASSWORD = "Probe!Strong#123";

// 1. Create user
let r = await fetch(`${SB}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true })
});
const u = await r.json();
console.log("user id:", u.id);

// 2. Sign in
r = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON, "content-type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD })
});
const s = await r.json();
console.log("access_token jwt header:", JSON.parse(Buffer.from(s.access_token.split(".")[0], "base64").toString()));
const claims = JSON.parse(Buffer.from(s.access_token.split(".")[1], "base64").toString());
console.log("jwt claims sub:", claims.sub, "role:", claims.role, "aud:", claims.aud);

// 3. Try GET /rest/v1/practices with user JWT — auth.uid() goes through this path
r = await fetch(`${SB}/rest/v1/practices?select=id&limit=1`, {
  headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}` }
});
console.log("\nGET practices (with user JWT):", r.status, await r.text());

// 4. Try the INSERT
r = await fetch(`${SB}/rest/v1/practices`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`,
    "content-type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({ name: "probe-uid", hipaa_covered_entity: true, frameworks_enabled: ["HIPAA"] })
});
console.log("INSERT practices (with user JWT):", r.status, await r.text());

// cleanup
await fetch(`${SB}/auth/v1/admin/users/${u.id}`, {
  method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` }
});
console.log("\nuser cleaned up");
