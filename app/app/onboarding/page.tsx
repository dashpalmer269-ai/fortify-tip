import { redirect } from "next/navigation";
import { getCurrentUserAndPractice, createAuthedServerClient } from "@/lib/supabase/server-auth";
import OnboardingWizard from "./OnboardingWizard";

export const dynamic = "force-dynamic";

/**
 * Single-URL onboarding wizard. Internal step state.
 * If the user already finished onboarding, send them straight to the dashboard.
 */
export default async function OnboardingHubPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");

  // If they have a practice and onboarding is complete → dashboard
  if (session.membership) {
    const supabase = await createAuthedServerClient();
    const { data: practice } = await supabase
      .from("practices")
      .select("id, name, description, employee_range, location_count_range, current_status, upcoming_audit_window, selected_plan, onboarding_step")
      .eq("id", session.membership.practice_id)
      .single();

    if (practice?.onboarding_step === "completed") {
      redirect("/app");
    }

    // Resume in progress
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

  // Brand new user — no practice yet
  return (
    <OnboardingWizard
      userEmail={session.user.email ?? ""}
      existingPractice={null}
      existingLocations={[]}
      existingIntegrations={[]}
    />
  );
}
