import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

// Insert as service_role (bypasses RLS) — confirms columns are fine.
let r = await fetch(`${SB}/rest/v1/practices`, {
  method: "POST",
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}`,
    "content-type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({ name: "service-role probe", hipaa_covered_entity: true, frameworks_enabled: ["HIPAA"] })
});
const insert = await r.json();
console.log("service_role insert:", r.status, insert);

if (r.ok) {
  await fetch(`${SB}/rest/v1/practices?id=eq.${insert[0].id}`, {
    method: "DELETE", headers: { apikey: SVC, Authorization: `Bearer ${SVC}` }
  });
  console.log("cleanup ok");
}
