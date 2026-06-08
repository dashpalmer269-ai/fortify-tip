import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import {
  verifyStripeWebhook,
  StripeWebhookError,
  type StripeCheckoutSession,
  type StripeSubscription,
  type StripeInvoice,
} from "@/lib/billing/stripe-webhook";
import { logPlatformEvent } from "@/lib/audit/platform";

/**
 * Stripe webhook handler.
 *
 * Subscribe this endpoint in your Stripe dashboard (Developers → Webhooks) for:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_succeeded
 *   - invoice.payment_failed
 *
 * Then copy the signing secret into STRIPE_WEBHOOK_SECRET on Vercel.
 *
 * Until both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set the route
 * 503s safely — it never trusts an unsigned payload.
 */
export const runtime = "nodejs"; // needs raw body + node:crypto

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const raw = await req.text();
  let event;
  try {
    event = verifyStripeWebhook(raw, req.headers.get("stripe-signature"), secret);
  } catch (e) {
    const msg = e instanceof StripeWebhookError ? e.message : "Signature verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as unknown as StripeCheckoutSession;
        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;

        // Resolve the practice via the user's membership (owner row)
        const { data: membership } = await db
          .from("practice_users")
          .select("practice_id")
          .eq("user_id", userId)
          .eq("role", "owner")
          .maybeSingle();
        if (!membership) break;

        const planFromMeta = session.metadata?.plan_id;
        const planNarrowed = ["software", "full_service"].includes(planFromMeta ?? "")
          ? (planFromMeta as "software" | "full_service")
          : null;
        await db
          .from("practices")
          .update({
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            billing_status: "active",
            selected_plan: planNarrowed,
          })
          .eq("id", membership.practice_id);

        await db.from("audit_logs").insert({
          practice_id: membership.practice_id,
          actor_service: "stripe",
          action: "billing.subscription_started",
          resource_type: "subscription",
          resource_id: session.subscription ?? null,
          metadata: { plan_id: session.metadata?.plan_id, customer: session.customer },
        });

        // Mirror to the durable platform log so the billing trail
        // survives any future practice deletion.
        await logPlatformEvent(db, {
          event: "billing.subscription_started",
          practice_id: membership.practice_id,
          actor_role: "stripe",
          payload: {
            plan_id: session.metadata?.plan_id,
            customer: session.customer,
            subscription: session.subscription,
          },
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as StripeSubscription;
        const { data: practice } = await db
          .from("practices")
          .select("id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        if (!practice) break;

        const newStatus =
          event.type === "customer.subscription.deleted" ? "canceled" : sub.status;

        const subPlan = sub.metadata?.plan_id;
        const subPlanNarrowed = ["software", "full_service"].includes(subPlan ?? "")
          ? (subPlan as "software" | "full_service")
          : undefined;
        await db
          .from("practices")
          .update({
            billing_status: newStatus,
            subscription_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            ...(subPlanNarrowed ? { selected_plan: subPlanNarrowed } : {}),
          })
          .eq("id", practice.id);

        await db.from("audit_logs").insert({
          practice_id: practice.id,
          actor_service: "stripe",
          action:
            event.type === "customer.subscription.deleted"
              ? "billing.subscription_canceled"
              : "billing.subscription_updated",
          resource_type: "subscription",
          resource_id: sub.id,
          metadata: { status: newStatus, cancel_at_period_end: sub.cancel_at_period_end },
        });

        await logPlatformEvent(db, {
          event:
            event.type === "customer.subscription.deleted"
              ? "billing.subscription_canceled"
              : "billing.subscription_changed",
          practice_id: practice.id,
          actor_role: "stripe",
          payload: { subscription_id: sub.id, status: newStatus },
        });
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as unknown as StripeInvoice;
        if (!invoice.subscription) break;
        const { data: practice } = await db
          .from("practices")
          .select("id")
          .eq("stripe_subscription_id", invoice.subscription)
          .maybeSingle();
        if (!practice) break;

        const status = event.type === "invoice.payment_failed" ? "past_due" : undefined;
        if (status) {
          await db.from("practices").update({ billing_status: status }).eq("id", practice.id);
        }
        await db.from("audit_logs").insert({
          practice_id: practice.id,
          actor_service: "stripe",
          action:
            event.type === "invoice.payment_failed"
              ? "billing.payment_failed"
              : "billing.payment_succeeded",
          resource_type: "invoice",
          resource_id: invoice.id,
          metadata: { amount_paid: invoice.amount_paid, status: invoice.status },
        });
        break;
      }

      default:
        // Ignore other event types — Stripe sends many; we only act on the above.
        break;
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
