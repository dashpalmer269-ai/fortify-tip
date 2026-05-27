/**
 * Simple in-memory token-bucket rate limiter.
 *
 * Edge-runtime safe (no external dependencies). State lives in the function
 * instance, so this is best-effort across Vercel cold starts but acceptable
 * for unauthenticated endpoints where the cost of a few extra requests
 * during a cold-start gap is negligible.
 *
 * For stronger guarantees (multi-instance, persistent across deploys),
 * swap the backing store to Vercel KV or Upstash Redis — the public API
 * stays the same.
 */

interface Bucket {
  tokens: number;
  refilledAt: number;
}

const buckets = new Map<string, Bucket>();

interface RateLimitOptions {
  /** Maximum tokens (= maximum burst). */
  capacity: number;
  /** Token refill rate, in tokens per second. */
  refillPerSecond: number;
}

const REAPER_INTERVAL_MS = 60_000;
let lastReap = 0;
function reapStaleBuckets(now: number): void {
  if (now - lastReap < REAPER_INTERVAL_MS) return;
  lastReap = now;
  for (const [key, b] of buckets) {
    if (now - b.refilledAt > 5 * 60_000) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

/**
 * Check whether `key` can consume one token. The key should be stable per
 * request source — typically the client IP, or for authenticated routes,
 * the user ID.
 */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  reapStaleBuckets(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: opts.capacity, refilledAt: now };
    buckets.set(key, bucket);
  }

  // Refill based on elapsed time
  const elapsedSec = (now - bucket.refilledAt) / 1000;
  if (elapsedSec > 0) {
    bucket.tokens = Math.min(opts.capacity, bucket.tokens + elapsedSec * opts.refillPerSecond);
    bucket.refilledAt = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterSeconds: 0, remaining: Math.floor(bucket.tokens) };
  }

  const deficit = 1 - bucket.tokens;
  const retryAfter = Math.ceil(deficit / opts.refillPerSecond);
  return { allowed: false, retryAfterSeconds: retryAfter, remaining: 0 };
}

/**
 * Resolve a stable client identifier from a Next.js request. Prefers the
 * forwarded IP set by Vercel's edge; falls back to a remote-addr-ish header
 * or an "anonymous" bucket if nothing else is available.
 */
export function clientKey(req: { headers: Headers }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous"
  );
}

/**
 * Pre-configured limits for common endpoint classes.
 */
export const RATE_LIMITS = {
  /** Signup is the most-abuseable endpoint — slow, low burst. */
  signup: { capacity: 5, refillPerSecond: 5 / 600 }, // 5 in 10 min
  /** Login likewise — protects against credential stuffing. */
  login: { capacity: 10, refillPerSecond: 10 / 600 }, // 10 in 10 min
  /** General API surface for unauthed callers. */
  unauthed: { capacity: 30, refillPerSecond: 30 / 60 }, // 30/min
  /** AI-backed endpoints (policy gen, risk summary). Expensive. */
  ai: { capacity: 10, refillPerSecond: 10 / 600 }, // 10 in 10 min
} as const;
