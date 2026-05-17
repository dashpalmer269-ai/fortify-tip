import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getPlan, priceIdFor, isBillingConfigured } from "@/lib/billing/plans";

/**
 * Stripe checkout session creator.
 *
 * Until you set STRIPE_SECRET_KEY and STRIPE_PRICE_* env vars in Vercel, this
 * route returns 503 with a clear message. Once set, it forwards the user to a
 * hosted Stripe checkout page.
 */
export async function POST(req: NextRequest) {
  if (!isBillingConfigured()) {
    return NextResponse.json(
      {
        error: "Billing not configured",
        next_step:
          "Set STRIPE_SECRET_KEY and STRIPE_PRICE_SOLO / STRIPE_PRICE_PRACTICE / STRIPE_PRICE_MULTISITE env vars in Vercel, then redeploy.",
      },
      { status: 503 }
    );
  }

  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan_id } = (await req.json().catch(() => ({ plan_id: null }))) as { plan_id: string | null };
  if (!plan_id) return NextResponse.json({ error: "plan_id required" }, { status: 400 });

  const plan = getPlan(plan_id);
  if (!plan) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  const price = priceIdFor(plan);
  if (!price) return NextResponse.json({ error: "Plan price not configured" }, { status: 503 });

  const stripeKey = process.env.STRIPE_SECRET_KEY!;
  const origin = req.nextUrl.origin;

  const params = new URLSearchParams();
  params.append("mode", "subscription");
  params.append("payment_method_types[]", "card");
  params.append("line_items[0][price]", price);
  params.append("line_items[0][quantity]", "1");
  params.append("customer_email", user.email ?? "");
  params.append("success_url", `${origin}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${origin}/pricing?canceled=1`);
  params.append("metadata[supabase_user_id]", user.id);
  params.append("metadata[plan_id]", plan_id);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const body = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !body.url) {
    return NextResponse.json(
      { error: body.error?.message ?? "Stripe checkout failed" },
      { status: 502 }
    );
  }
  return NextResponse.json({ url: body.url });
}
