#!/usr/bin/env node
// Calls the whoami() RPC with a freshly minted user JWT to see what auth.uid()
// resolves to in the database context.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = `whoami-${Date.now()}@fortify-test.local`;
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

console.log("test user id:        ", u.id);
console.log("jwt sub claim:       ", JSON.parse(Buffer.from(s.access_token.split(".")[1], "base64").toString()).sub);

// Call whoami() with the user's JWT
r = await fetch(`${SB}/rest/v1/rpc/whoami`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "content-type": "application/json" },
  body: "{}"
});
console.log("\nwhoami() response:   ", r.status);
const body = await r.text();
console.log(body);

// Cleanup
await fetch(`${SB}/auth/v1/admin/users/${u.id}`, {
  method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` }
});
