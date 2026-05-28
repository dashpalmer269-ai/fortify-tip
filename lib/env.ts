/**
 * Typed environment variables.
 *
 * Validates at first import. Throws a clear, aggregated error if any required
 * variable is missing, so the failure happens at server boot instead of as a
 * confusing runtime error inside a route handler.
 *
 * Use `env.X` instead of `process.env.X` everywhere. The compiler now knows
 * which variables exist, which are required, and what their types are, so
 * the `!` non-null assertions disappear from call sites.
 */

import { z } from "zod";

const Schema = z.object({
  // ── Required ─────────────────────────────────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),

  // ── Optional ─────────────────────────────────────────────────────────────
  CRON_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  NVD_API_KEY: z.string().optional(),
  OTX_API_KEY: z.string().optional(),
  M365_CLIENT_ID: z.string().optional(),
  M365_CLIENT_SECRET: z.string().optional(),
  M365_REDIRECT_URI: z.string().url().optional(),
  MS_CLIENT_ID: z.string().optional(),
  MS_CLIENT_SECRET: z.string().optional(),
  MS_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  CREDENTIAL_KMS_KEY: z.string().min(32).optional(),

  // ── Runtime ──────────────────────────────────────────────────────────────
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof Schema>;

function load(): Env {
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables. Check .env.local:\n${issues}`
    );
  }
  return parsed.data;
}

/**
 * Lazy proxy so that importing this file in a build-time context (where some
 * env vars may legitimately be absent — for example, in a static page build
 * step that doesn't need Anthropic) doesn't fail. Required vars are still
 * enforced the first time something actually reads them at runtime.
 */
let _cache: Env | null = null;
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_cache) _cache = load();
    return _cache[prop as keyof Env];
  },
});
