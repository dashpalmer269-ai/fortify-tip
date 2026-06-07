/**
 * Next.js configuration.
 *
 * Security headers applied to every response. CSP is intentionally
 * permissive for inline styles (we use inline <style> for confetti
 * animations and a few component-scoped keyframes) and unsafe-eval
 * (turbopack-compiled chunks). Tighten this when we add a build-time
 * style-nonce strategy.
 *
 * The default export is wrapped by withSentryConfig so Sentry can hook
 * into the build. If NEXT_PUBLIC_SENTRY_DSN isn't set, Sentry's runtime
 * init becomes a no-op (see instrumentation.ts); the build-time wrapper
 * still runs harmlessly.
 */
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // *.ingest.sentry.io is the Sentry event ingestion endpoint.
              // Without it browsers block the client SDK's fetch and we lose
              // every client-side error report.
              "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io wss://*.supabase.co",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Org / project slugs only become required when we start uploading source
  // maps (needs SENTRY_AUTH_TOKEN). Without them, the wrapper is benign
  // build-time wiring; error capture still works at runtime via the DSN.
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  // Toggle on once we want Sentry monitoring of Vercel crons.
  automaticVercelMonitors: false,
});
