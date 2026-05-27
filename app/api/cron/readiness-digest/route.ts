import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/provider";
import { readinessDigestEmail } from "@/lib/email/templates";
import { generateReportSummary } from "@/lib/ai/compliance-ai";

/**
 * Weekly readiness digest — runs Monday 14:00 UTC (09:00 ET) per vercel.json.
 *
 * For every practice that has at least one owner/admin:
 *   1. Compute current readiness (audit_readiness_summary RPC)
 *   2. Compute last-week readiness from evidence_snapshots
 *   3. Count critical-open controls, drift alerts in the last 7 days,
 *      BAAs expiring in the next 30 days
 *   4. Generate an AI executive summary via Claude
 *   5. Insert an in-app notification + send an email to each admin
 *   6. Audit-log the digest
 *
 * Cron authentication: Vercel sends `x-vercel-cron: 1` on its scheduled
 * invocations; we accept that header OR a Bearer ${CRON_SECRET} match.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

interface ReadinessRow {
  framework_code: string;
  weighted_pct: number;
  satisfied: number;
  total: number;
}

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const got = req.headers.get("authorization");
  return got === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const origin = new URL(req.url).origin;
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString();

  const { data: practices } = await db
    .from("practices")
    .select("id, name")
    .eq("onboarding_step", "completed");

  let digestsSent = 0;
  let digestsSkipped = 0;
  const errors: string[] = [];

  for (const practice of practices ?? []) {
    try {
      // Readiness now
      const { data: readinessRows } = await db.rpc("audit_readiness_summary", {
        p_practice_id: practice.id,
      });
      const readiness = (readinessRows ?? []) as ReadinessRow[];
      const overallPct =
        readiness.length > 0
          ? Math.round(
              readiness.reduce((s, r) => s + (Number(r.weighted_pct) || 0), 0) / readiness.length
            )
          : 0;

      // Readiness last week from snapshots
      const { data: lastSnap } = await db
        .from("evidence_snapshots")
        .select("captured_at, observed_value")
        .eq("practice_id", practice.id)
        .lte("captured_at", weekAgo)
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastWeekPct =
        lastSnap && typeof (lastSnap.observed_value as { overall_pct?: number })?.overall_pct === "number"
          ? Math.round((lastSnap.observed_value as { overall_pct: number }).overall_pct)
          : overallPct;
      const deltaPct = overallPct - lastWeekPct;

      // Critical open
      const { data: criticalRows } = await db
        .from("practice_controls")
        .select("controls(default_priority)")
        .eq("practice_id", practice.id)
        .eq("status", "non_compliant")
        .returns<Array<{ controls: { default_priority: string } | null }>>();
      const criticalOpen = (criticalRows ?? []).filter(
        (r) => r.controls?.default_priority === "critical"
      ).length;

      // Drift alerts this week
      const { data: drift } = await db
        .from("drift_alerts")
        .select("id", { count: "exact", head: true })
        .eq("practice_id", practice.id)
        .gte("detected_at", weekAgo);
      const driftAlertsWeek = (drift as unknown as { length: number } | null)?.length ?? 0;

      // BAAs expiring in next 30 days
      const { data: baas } = await db
        .from("baas")
        .select("id", { count: "exact", head: true })
        .eq("practice_id", practice.id)
        .eq("status", "active")
        .lte("expiration_date", thirtyDays);
      const baasExpiring = (baas as unknown as { length: number } | null)?.length ?? 0;

      // AI summary
      let aiSummary = "";
      try {
        aiSummary = await generateReportSummary({
          practice_name: practice.name,
          report_type: "weekly_readiness_digest",
          framework: null,
          readiness_summary: readiness,
          critical_open: criticalOpen,
          recent_drift_alerts: driftAlertsWeek,
          baas_missing: baasExpiring,
        });
      } catch {
        aiSummary = `Overall readiness is ${overallPct}%. ${criticalOpen} critical controls remain open. Review the dashboard for details.`;
      }

      // Get admin emails for this practice
      const { data: admins } = await db
        .from("practice_users")
        .select("user_id")
        .eq("practice_id", practice.id)
        .in("role", ["owner", "admin"]);
      if (!admins || admins.length === 0) {
        digestsSkipped++;
        continue;
      }

      const adminEmails: string[] = [];
      for (const a of admins) {
        const { data: u } = await db.auth.admin.getUserById(a.user_id);
        if (u.user?.email) adminEmails.push(u.user.email);
      }

      // In-app notifications for every admin
      await db.from("notifications").insert(
        admins.map((a) => ({
          user_id: a.user_id,
          practice_id: practice.id,
          kind: "digest.weekly",
          title: `Weekly readiness: ${overallPct}%${deltaPct === 0 ? "" : ` (${deltaPct > 0 ? "+" : ""}${deltaPct}%)`}`,
          body: aiSummary.split("\n")[0]?.slice(0, 240) ?? null,
          link: "/app",
        }))
      );

      // Email (best-effort, no-ops without RESEND_API_KEY)
      if (adminEmails.length > 0) {
        await sendEmail({
          to: adminEmails,
          subject: `Weekly readiness digest — ${practice.name}`,
          html: readinessDigestEmail({
            practice_name: practice.name,
            overall_pct: overallPct,
            delta_pct: deltaPct,
            critical_open: criticalOpen,
            drift_alerts_week: driftAlertsWeek,
            baas_expiring: baasExpiring,
            ai_summary: aiSummary,
            app_url: origin,
          }),
          tag: "digest.weekly",
        });
      }

      // Audit log
      await db.from("audit_logs").insert({
        practice_id: practice.id,
        actor_service: "cron.readiness-digest",
        action: "digest.sent",
        resource_type: "practice",
        resource_id: practice.id,
        metadata: {
          overall_pct: overallPct,
          delta_pct: deltaPct,
          critical_open: criticalOpen,
          drift_alerts_week: driftAlertsWeek,
          baas_expiring: baasExpiring,
          email_recipients: adminEmails.length,
        },
      });

      digestsSent++;
    } catch (e) {
      errors.push(`${practice.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    digests_sent: digestsSent,
    digests_skipped: digestsSkipped,
    errors,
  });
}
