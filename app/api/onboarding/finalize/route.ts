import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import type { OnboardingState } from "@/app/app/onboarding/types";

/**
 * Finalize onboarding:
 *  - upserts the practices row
 *  - upserts the practice_users row (caller becomes owner if new)
 *  - replaces practice_locations
 *  - replaces onboarding_integration_choices
 *  - inserts assistance_request if schedule mode
 *  - pre-seeds healthcare_baseline practice_controls
 *  - marks onboarding_step = 'completed' and onboarding_completed_at = now
 */
export async function POST(req: NextRequest) {
  const supabase = await createAuthedServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { state: OnboardingState; existing_practice_id?: string | null }
    | null;
  if (!body?.state) return NextResponse.json({ error: "Missing state" }, { status: 400 });

  const { state } = body;
  const info = state.information;
  const fort = state.fortification;
  const safe = state.safeguards;
  const pay = state.payment;

  // ── Server-side validation ────────────────────────────────────────────────
  const issues: string[] = [];
  if (!info.practice_name.trim()) issues.push("Practice name is required");
  if (!info.description.trim()) issues.push("Practice description is required");
  if (!info.employee_range) issues.push("Number of employees is required");
  if (!info.location_count_range) issues.push("Number of locations is required");
  const validLocations = info.locations.filter(
    (l) => l.street_1.trim() && l.city.trim() && l.region.trim() && l.postal_code.trim()
  );
  if (validLocations.length === 0) issues.push("At least one complete location is required");
  if (!fort.current_status) issues.push("Current status is required");
  if (!fort.upcoming_audit_window) issues.push("Upcoming audit selection is required");
  if (!safe.mode) issues.push("Safeguard setup mode is required");
  if (safe.mode === "schedule" && (!safe.assistance_date || !safe.assistance_window)) {
    issues.push("Assistance call date and time window are required");
  }
  if (!pay.selected_plan) issues.push("Plan selection is required");

  if (issues.length > 0) {
    return NextResponse.json({ error: issues.join(" · ") }, { status: 400 });
  }

  // ── Upsert practice ───────────────────────────────────────────────────────
  let practiceId = body.existing_practice_id ?? null;
  const practiceFields = {
    name: info.practice_name.trim(),
    description: info.description.trim(),
    employee_range: info.employee_range,
    location_count_range: info.location_count_range,
    current_status: fort.current_status,
    upcoming_audit_window: fort.upcoming_audit_window,
    selected_plan: pay.selected_plan,
    onboarding_step: "completed" as const,
    onboarding_completed_at: new Date().toISOString(),
    hipaa_covered_entity: true,
    frameworks_enabled: ["HIPAA"],
  };

  if (practiceId) {
    const { error: updErr } = await supabase
      .from("practices")
      .update(practiceFields)
      .eq("id", practiceId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  } else {
    const { data: created, error: insErr } = await supabase
      .from("practices")
      .insert(practiceFields)
      .select("id")
      .single();
    if (insErr || !created) {
      return NextResponse.json({ error: insErr?.message ?? "Failed to create practice" }, { status: 500 });
    }
    practiceId = created.id;

    // Make this user the owner
    const { error: puErr } = await supabase.from("practice_users").insert({
      practice_id: practiceId,
      user_id: user.id,
      role: "owner",
    });
    if (puErr) return NextResponse.json({ error: puErr.message }, { status: 500 });
  }

  // ── Replace locations ─────────────────────────────────────────────────────
  await supabase.from("practice_locations").delete().eq("practice_id", practiceId);
  if (validLocations.length > 0) {
    const { error: locErr } = await supabase.from("practice_locations").insert(
      validLocations.map((l) => ({
        practice_id: practiceId,
        label: l.label?.trim() || null,
        street_1: l.street_1.trim(),
        street_2: l.street_2?.trim() || null,
        city: l.city.trim(),
        region: l.region.trim(),
        postal_code: l.postal_code.trim(),
      }))
    );
    if (locErr) return NextResponse.json({ error: locErr.message }, { status: 500 });
  }

  // ── Replace integration choices ───────────────────────────────────────────
  await supabase.from("onboarding_integration_choices").delete().eq("practice_id", practiceId);
  if (safe.mode === "manual" && safe.integrations.length > 0) {
    await supabase.from("onboarding_integration_choices").insert(
      safe.integrations.map((t) => ({ practice_id: practiceId, integration_type: t }))
    );
  }

  // ── Assistance request (if scheduled) ─────────────────────────────────────
  if (safe.mode === "schedule") {
    await supabase.from("assistance_requests").insert({
      practice_id: practiceId,
      preferred_date: safe.assistance_date || null,
      preferred_time_window: safe.assistance_window || null,
      contact_email: user.email,
      contact_phone: safe.assistance_phone?.trim() || null,
      notes: safe.assistance_notes?.trim() || null,
    });
  }

  // ── Pre-seed healthcare baseline controls (if not already) ───────────────
  const { data: existingPC } = await supabase
    .from("practice_controls")
    .select("id", { count: "exact", head: true })
    .eq("practice_id", practiceId);
  if (!existingPC || (existingPC as unknown as { length: number }).length === 0) {
    const { data: baseline } = await supabase
      .from("controls")
      .select("id")
      .eq("healthcare_baseline", true);
    if (baseline?.length) {
      await supabase.from("practice_controls").insert(
        baseline.map((c) => ({
          practice_id: practiceId,
          control_id: c.id,
          status: "not_started" as const,
        }))
      );
    }
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  await supabase.from("audit_logs").insert({
    practice_id: practiceId,
    actor_user_id: user.id,
    action: "onboarding.completed",
    resource_type: "practice",
    resource_id: practiceId,
    metadata: {
      plan: pay.selected_plan,
      employee_range: info.employee_range,
      location_count: validLocations.length,
      safeguards_mode: safe.mode,
    },
  });

  return NextResponse.json({ ok: true, practice_id: practiceId });
}
