/**
 * Daily: walk every active practice and recompute each control's status
 * based on the satisfaction_rule of its evidence_checks.
 *
 * Why this exists:
 *   The schema declares satisfaction_rule (jsonb) on evidence_checks since
 *   migration 034, but until migration 042 added evaluate_satisfaction_rule
 *   nothing actually evaluated it. The result: a control marked "compliant"
 *   stayed compliant even after its supporting evidence aged out of the
 *   rule's age_days_lte window. Now this cron evaluates the rule against
 *   the current evidence state and flips status accordingly:
 *     all rules pass → compliant
 *     some rules pass → partial
 *     no rules pass  → non_compliant
 *   "not_started" rows are not touched — they represent work that hasn't
 *   begun and shouldn't auto-activate.
 *
 * Scheduled in vercel.json via the standard CRON_SECRET-gated hook.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Cron auth — Vercel sets the Authorization header to "Bearer <CRON_SECRET>".
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: practices } = await db
    .from("practices")
    .select("id")
    .returns<Array<{ id: string }>>();
  if (!practices) {
    return NextResponse.json({ ok: true, processed: 0, changed: 0 });
  }

  let totalChanged = 0;
  let processed = 0;
  const errors: string[] = [];

  for (const p of practices) {
    try {
      const { data, error } = await db.rpc("recompute_practice_control_status", {
        p_practice_id: p.id,
      });
      if (error) {
        errors.push(`${p.id}: ${error.message}`);
        continue;
      }
      totalChanged += typeof data === "number" ? data : 0;
      processed += 1;
    } catch (e) {
      errors.push(`${p.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    changed: totalChanged,
    errors: errors.slice(0, 10),
  });
}
