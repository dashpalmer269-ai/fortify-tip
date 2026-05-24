import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import OnboardingWizard from "./OnboardingWizard";
import EmployeeOnboarding from "./EmployeeOnboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingHubPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");

  const accountType =
    (session.user.user_metadata?.account_type as "admin" | "employee" | undefined) ?? "admin";

  // If membership exists and onboarding complete → dashboard
  if (session.membership) {
    const supabase = await createAuthedServerClient();
    const { data: practice } = await supabase
      .from("practices")
      .select(
        "id, name, description, employee_range, location_count_range, current_status, upcoming_audit_window, selected_plan, onboarding_step"
      )
      .eq("id", session.membership.practice_id)
      .single();
    if (practice?.onboarding_step === "completed") redirect("/app");

    // Admin in progress — resume wizard
    if (accountType === "admin") {
      const { data: locations } = await supabase
        .from("practice_locations")
        .select("*")
        .eq("practice_id", session.membership.practice_id)
        .order("created_at", { ascending: true });
      const { data: integrations } = await supabase
        .from("onboarding_integration_choices")
        .select("integration_type")
        .eq("practice_id", session.membership.practice_id);
      return (
        <OnboardingWizard
          userEmail={session.user.email ?? ""}
          existingPractice={practice ?? null}
          existingLocations={locations ?? []}
          existingIntegrations={(integrations ?? []).map((i) => i.integration_type)}
        />
      );
    }
    // Employee with membership but onboarding incomplete → just send to dashboard.
    redirect("/app");
  }

  // No membership yet
  if (accountType === "employee") {
    const supabase = await createAuthedServerClient();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("user_id, full_name, onboarded_at, pending_practice_name, job_title, primary_address, phone")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (profile?.onboarded_at) redirect("/app/pending");

    return (
      <EmployeeOnboarding
        userEmail={session.user.email ?? ""}
        existingProfile={profile ?? null}
      />
    );
  }

  // Admin without practice — fresh wizard
  return (
    <OnboardingWizard
      userEmail={session.user.email ?? ""}
      existingPractice={null}
      existingLocations={[]}
      existingIntegrations={[]}
    />
  );
}
