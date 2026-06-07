/**
 * Next.js client-side instrumentation — Next 16 convention.
 *
 * Browser runtime Sentry init. Mirrors the no-PHI hardening from the
 * server-side init: sendDefaultPii off, tracesSampleRate conservative,
 * beforeSend scrubs any captured headers we don't want to ingest.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    replaysOnErrorSampleRate: 0.0,
    replaysSessionSampleRate: 0.0,
    beforeSend: (event) => {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        delete event.request.headers["cookie"];
        delete event.request.headers["authorization"];
      }
      return event;
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
