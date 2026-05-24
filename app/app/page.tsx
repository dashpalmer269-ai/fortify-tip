import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding");

  const supabase = await createAuthedServerClient();

  // Compliance readiness — one row per enabled framework
  const { data: readiness } = await supabase.rpc("audit_readiness_summary", {
    p_practice_id: session.membership.practice_id,
  });

  // Active critical findings: non-compliant controls with default_priority=critical
  const { data: critical } = await supabase
    .from("practice_controls")
    .select("id, status, controls(control_key, title, default_priority, category)")
    .eq("practice_id", session.membership.practice_id)
    .eq("status", "non_compliant");

  // Recent activity from audit log
  const { data: activity } = await supabase
    .from("audit_logs")
    .select("id, action, resource_type, metadata, occurred_at, actor_service")
    .eq("practice_id", session.membership.practice_id)
    .order("occurred_at", { ascending: false })
    .limit(8);

  return (
    <DashboardClient
      practiceName={
        (session.membership.practices as unknown as { name: string } | null)?.name ?? ""
      }
      readiness={readiness ?? []}
      criticalCount={(critical ?? []).filter(
        (c) =>
          (c.controls as unknown as { default_priority: string } | null)?.default_priority === "critical"
      ).length}
      recentActivity={activity ?? []}
    />
  );
}
