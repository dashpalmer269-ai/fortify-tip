/**
 * Stripe webhook signature verification.
 *
 * Stripe signs every webhook with HMAC-SHA256 over `${timestamp}.${rawBody}`
 * using the endpoint's STRIPE_WEBHOOK_SECRET. We verify the signature manually
 * (no Stripe SDK dependency) and bail on tolerance/timestamp drift.
 *
 * Reference: https://stripe.com/docs/webhooks/signatures
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 300; // 5 minutes — matches Stripe's default

export interface StripeWebhookVerifiedEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
  created: number;
}

export class StripeWebhookError extends Error {}

/**
 * Verify the Stripe signature header against the raw request body.
 * Returns the parsed event, or throws if the signature is invalid or
 * the timestamp is outside the tolerance window.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): StripeWebhookVerifiedEvent {
  if (!signatureHeader) throw new StripeWebhookError("Missing Stripe-Signature header");

  // Header format: t=1234567890,v1=abc...,v0=...
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim() ?? "", v?.trim() ?? ""];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    throw new StripeWebhookError("Malformed signature header");
  }

  const now = Math.floor(Date.now() / 1000);
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum) || Math.abs(now - tsNum) > TOLERANCE_SECONDS) {
    throw new StripeWebhookError("Signature timestamp outside tolerance window");
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new StripeWebhookError("Signature mismatch");
  }

  try {
    return JSON.parse(rawBody) as StripeWebhookVerifiedEvent;
  } catch {
    throw new StripeWebhookError("Body is not valid JSON");
  }
}

/* ──────────────────────────────────────────────────────────────────────── *
 * Event payload shapes — narrowed to just the fields we touch
 * ──────────────────────────────────────────────────────────────────────── */

export interface StripeCheckoutSession {
  id: string;
  customer: string | null;
  subscription: string | null;
  customer_email: string | null;
  metadata: { supabase_user_id?: string; plan_id?: string };
  payment_status: string;
  status: string;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete";
  current_period_end: number;
  cancel_at_period_end: boolean;
  metadata: { supabase_user_id?: string; plan_id?: string };
}

export interface StripeInvoice {
  id: string;
  customer: string;
  subscription: string | null;
  amount_paid: number;
  status: string;
}
