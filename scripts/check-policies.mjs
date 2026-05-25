import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;

// Use Supabase's PostgreSQL via RPC to inspect policies. Best path: a custom RPC,
// but we don't have one. Try information_schema / pg_policies via the meta endpoint.
const sql = `select schemaname, tablename, policyname, cmd, roles, qual, with_check
             from pg_policies where tablename = 'practices' order by policyname;`;
let r = await fetch(`${SB}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "content-type": "application/json" },
  body: JSON.stringify({ sql })
});
console.log("rpc exec_sql:", r.status, (await r.text()).slice(0, 200));
