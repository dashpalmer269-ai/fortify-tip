/**
 * Next.js instrumentation hook — invoked once when each runtime boots.
 *
 * Initializes Sentry for the Node (server) and Edge runtimes. The browser
 * runtime is wired separately by `instrumentation-client.ts`.
 *
 * No-PHI invariant: tracesSampleRate is conservative (10%), sendDefaultPii
 * is false, and we strip request bodies + auth headers in beforeSend.
 * The architectural commitment is that PHI never reaches Fortify, but
 * Sentry is a defense-in-depth surface: we treat any captured payload
 * as if it might contain something we didn't expect.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend: scrubSensitive,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend: scrubSensitive,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;

/**
 * Drop request bodies, cookies, and auth headers from any captured event.
 * Belt-and-braces — Sentry's defaults already redact most of this, but the
 * architectural NO-PHI commitment means we don't want to find out otherwise.
 */
function scrubSensitive(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers["cookie"];
      delete event.request.headers["authorization"];
      delete event.request.headers["x-supabase-auth"];
    }
  }
  return event;
}
