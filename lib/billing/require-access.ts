/**
 * Practice access gate for mutating routes.
 *
 * Wrap a route handler with this helper to enforce that the practice has
 * an active subscription or an unexpired demo grant. On failure returns a
 * 402 Payment Required response with a structured body so the client can
 * surface the right upsell — "your demo ended" vs "you're unsubscribed".
 *
 * Usage in a route handler:
 *
 *   const guard = await requirePracticeAccess(db, practiceId);
 *   if (!guard.ok) return guard.response;
 *   // ...mutating work proceeds
 *
 * Pairs with the on-read computeAccessState() helper in ./access.ts —
 * that one is for rendering badges/banners; this one is for blocking
 * writes.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { computeAccessState, type AccessState } from "@/lib/billing/access";

export type AccessGuard =
  | { ok: true; state: AccessState }
  | { ok: false; response: NextResponse };

export async function requirePracticeAccess(
  db: SupabaseClient<Database>,
  practiceId: string
): Promise<AccessGuard> {
  const { data: practice, error } = await db
    .from("practices")
    .select("plan_source, access_expires_at, billing_status")
    .eq("id", practiceId)
    .maybeSingle();

  if (error || !practice) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Practice not found" },
        { status: 404 }
      ),
    };
  }

  const state = computeAccessState(practice);

  if (state.kind === "active") {
    return { ok: true, state };
  }

  if (state.kind === "demo_expired") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Demo expired",
          reason: "demo_expired",
          expired_at: state.expired_at,
          next_step: "Subscribe to continue using Fortify.",
        },
        { status: 402 }
      ),
    };
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "Subscription required",
        reason: "unpaid",
        next_step: "Subscribe to continue using Fortify.",
      },
      { status: 402 }
    ),
  };
}
