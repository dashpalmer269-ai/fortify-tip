import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import { isOfficer, type Role } from "@/lib/auth/permissions";
import DashboardClient from "./DashboardClient";
import DashboardEmployee from "./DashboardEmployee";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();
  const role = session.membership.role as Role;
  const practiceName = session.membership.practice_name;

  // Staff / auditor → simplified employee dashboard
  if (!isOfficer(role)) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, job_title")
      .eq("user_id", session.user.id)
      .maybeSingle();

    const { data: openPolicies } = await supabase
      .from("policies")
      .select("id, title, framework, policy_type, status, updated_at")
      .eq("practice_id", session.membership.practice_id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(5);

    return (
      <DashboardEmployee
        practiceName={practiceName}
        fullName={profile?.full_name ?? null}
        jobTitle={profile?.job_title ?? null}
        userEmail={session.user.email ?? ""}
        role={role}
        publishedPolicies={openPolicies ?? []}
      />
    );
  }

  // Admin / officer dashboard
  const { data: readiness } = await supabase.rpc("audit_readiness_summary", {
    p_practice_id: session.membership.practice_id,
  });

  const { data: critical } = await supabase
    .from("practice_controls")
    .select("id, status, controls(control_key, title, default_priority, category)")
    .eq("practice_id", session.membership.practice_id)
    .eq("status", "non_compliant")
    .returns<Array<{
      id: string;
      status: string;
      controls: { control_key: string; title: string; default_priority: string; category: string } | null;
    }>>();

  const { data: activity } = await supabase
    .from("audit_logs")
    .select("id, action, resource_type, metadata, occurred_at, actor_service")
    .eq("practice_id", session.membership.practice_id)
    .order("occurred_at", { ascending: false })
    .limit(8);

  return (
    <DashboardClient
      practiceName={practiceName}
      readiness={readiness ?? []}
      criticalCount={(critical ?? []).filter(
        (c) => c.controls?.default_priority === "critical"
      ).length}
      recentActivity={activity ?? []}
    />
  );
}
