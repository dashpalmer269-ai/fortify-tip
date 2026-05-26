import { redirect } from "next/navigation";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession } from "@/lib/auth/session";
import OnboardingWizard from "./OnboardingWizard";
import EmployeeOnboarding from "./EmployeeOnboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingHubPage() {
  const session = await getAppSession();

  // Route by session state. The /app layout normally redirects you here for
  // 'no_practice', but a user can also land here directly from /signup.
  switch (session.kind) {
    case "unauthenticated":
      redirect("/login");
    case "denied":
      redirect("/denied");
    case "pending":
      redirect("/pending");
    case "active":
      break; // handled below — admin mid-onboarding can resume
    case "no_practice":
      break; // common case — fresh signup
  }

  const supabase = await createAuthedServerClient();

  // ── Active membership: resume admin wizard, or send standards to /app ──
  if (session.kind === "active") {
    const { data: practice } = await supabase
      .from("practices")
      .select(
        "id, name, description, employee_range, location_count_range, current_status, upcoming_audit_window, selected_plan, onboarding_step"
      )
      .eq("id", session.membership.practice_id)
      .single();

    if (practice?.onboarding_step === "completed") redirect("/app");

    // Owners/admins resume their wizard; everyone else just enters the app.
    if (["owner", "admin"].includes(session.membership.role)) {
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
    redirect("/app");
  }

  // ── No membership: standards see the verification form, admins see wizard
  if (session.accountType === "employee") {
    if (session.profile?.onboarded_at) redirect("/pending");
    return (
      <EmployeeOnboarding
        userEmail={session.user.email ?? ""}
        existingProfile={session.profile ?? null}
      />
    );
  }

  return (
    <OnboardingWizard
      userEmail={session.user.email ?? ""}
      existingPractice={null}
      existingLocations={[]}
      existingIntegrations={[]}
    />
  );
}
