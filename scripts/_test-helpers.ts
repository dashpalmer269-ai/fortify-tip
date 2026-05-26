/**
 * Shared helpers for the scripts/test-*.ts suites.
 *
 * Owns typed env loading, Supabase admin-API calls, session cookie building,
 * and the pretty-print helpers (step / ok / fail / colors). Every test file
 * imports from here, so adding a new helper happens in one place.
 */

import { readFileSync } from "node:fs";

interface TestEnv {
  SB: string;
  ANON: string;
  SVC: string;
  APP: string;
}

function loadEnv(): TestEnv {
  const raw = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  for (const k of required) {
    if (!raw[k]) throw new Error(`Missing env var ${k} in .env.local`);
  }
  return {
    SB: raw.NEXT_PUBLIC_SUPABASE_URL!,
    ANON: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SVC: raw.SUPABASE_SERVICE_ROLE_KEY!,
    APP: process.env.APP_URL ?? "http://localhost:3456",
  };
}

export const env: TestEnv = loadEnv();

/* ──────────────────────────────────────────────────────────────────────── *
 * Pretty-print
 * ──────────────────────────────────────────────────────────────────────── */

export const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", x: "\x1b[0m" };
export const step = (n: number | string, t: string): void => console.log(`\n${C.y}[${n}]${C.x} ${t}`);
export const ok = (m: string): void => console.log(`  ${C.g}✓${C.x} ${m}`);
export const fail = (m: string): void => {
  console.log(`  ${C.r}✗${C.x} ${m}`);
  process.exitCode = 1;
};

/* ──────────────────────────────────────────────────────────────────────── *
 * Supabase auth admin
 * ──────────────────────────────────────────────────────────────────────── */

export interface CreatedUser {
  id: string;
  email: string;
  user_metadata?: { account_type?: "admin" | "employee" };
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  user: CreatedUser;
}

export async function adminCreate(
  email: string,
  password: string,
  accountType: "admin" | "employee"
): Promise<CreatedUser> {
  const r = await fetch(`${env.SB}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.SVC,
      Authorization: `Bearer ${env.SVC}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { account_type: accountType },
    }),
  });
  if (!r.ok) throw new Error(`adminCreate ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()) as CreatedUser;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const r = await fetch(`${env.SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.ANON, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`signIn ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()) as Session;
}

export function cookieFor(session: Session): string {
  const projectRef = new URL(env.SB).hostname.split(".")[0];
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

export async function deleteUser(userId: string): Promise<void> {
  await fetch(`${env.SB}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: env.SVC, Authorization: `Bearer ${env.SVC}` },
  }).catch(() => {});
}

/* ──────────────────────────────────────────────────────────────────────── *
 * PostgREST helpers (service-role)
 * ──────────────────────────────────────────────────────────────────────── */

export async function restGet<T = unknown>(path: string): Promise<T> {
  const r = await fetch(`${env.SB}/rest/v1/${path}`, {
    headers: { apikey: env.SVC, Authorization: `Bearer ${env.SVC}` },
  });
  if (!r.ok) throw new Error(`restGet ${path}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export async function restDel(path: string): Promise<void> {
  await fetch(`${env.SB}/rest/v1/${path}`, {
    method: "DELETE",
    headers: { apikey: env.SVC, Authorization: `Bearer ${env.SVC}`, Prefer: "return=minimal" },
  });
}

/* ──────────────────────────────────────────────────────────────────────── *
 * App API helpers
 * ──────────────────────────────────────────────────────────────────────── */

export async function appPost(
  path: string,
  body: unknown,
  cookie?: string
): Promise<Response> {
  return fetch(`${env.APP}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function appGet(path: string, cookie?: string): Promise<Response> {
  return fetch(`${env.APP}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
}

/* ──────────────────────────────────────────────────────────────────────── *
 * Cleanup tracker
 * ──────────────────────────────────────────────────────────────────────── */

export interface Tracker {
  users: string[];
  practices: string[];
  cleanup: () => Promise<void>;
}

export function makeTracker(): Tracker {
  const t: Tracker = {
    users: [],
    practices: [],
    cleanup: async () => {
      for (const id of t.practices) await restDel(`practices?id=eq.${id}`);
      for (const id of t.users) await deleteUser(id);
    },
  };
  return t;
}

/* ──────────────────────────────────────────────────────────────────────── *
 * Onboarding finalize body builder — every test reuses this shape
 * ──────────────────────────────────────────────────────────────────────── */

export function finalizePayload(practiceName: string) {
  return {
    state: {
      information: {
        practice_name: practiceName,
        description: "Family medicine practice for testing.",
        employee_range: "21-50" as const,
        location_count_range: "1-2" as const,
        locations: [
          {
            label: "Main",
            street_1: "1 Test St",
            street_2: "",
            city: "Austin",
            region: "TX",
            postal_code: "78701",
          },
        ],
      },
      fortification: {
        current_status: "starting_brand_new" as const,
        upcoming_audit_window: "within_90_days" as const,
      },
      safeguards: {
        mode: "manual" as const,
        integrations: [] as string[],
        assistance_date: "",
        assistance_window: "",
        assistance_phone: "",
        assistance_notes: "",
      },
      payment: { selected_plan: "practice" as const },
    },
    existing_practice_id: null as string | null,
  };
}

export function employeeSubmitBody(
  practiceName: string,
  fullName = "Jane Doe",
  jobTitle = "Office Manager",
  adminName = "Practice Admin"
) {
  return {
    full_name: fullName,
    job_title: jobTitle,
    phone: null,
    pending_practice_name: practiceName,
    claimed_admin_name: adminName,
    primary_address: {
      street_1: "1 Main",
      street_2: null,
      city: "Austin",
      region: "TX",
      postal_code: "78701",
    },
  };
}
