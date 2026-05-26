import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { sanitizeForAudit, scanFieldsForPhi } from "@/lib/compliance/no-phi";
import { OnboardingFinalizeSchema, parseBody } from "@/lib/schemas/api";
import type { Inserts } from "@/lib/supabase/types";

/**
 * Finalize onboarding.
 *
 * DEMO WORKAROUND (TODO: revisit after beta): writes via service-role to
 * dodge the auth.uid() RLS issue on Supabase ES256/JWKS projects. The
 * authenticated user.id is what we tie membership/audit-log rows to —
 * service-role isn't trusted with body data.
 */
export async function POST(req: NextRequest) {
  const userClient = await createAuthedServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Body validation + No-PHI scan in one call.
  const parsed = await parseBody(OnboardingFinalizeSchema, req);
  if (!parsed.ok) return parsed.response;
  const { state, existing_practice_id } = parsed.data;
  const { information: info, fortification: fort, safeguards: safe, payment: pay } = state;

  // Locations need to be complete (zod already enforced min 1, but a row
  // with blank-only strings would have passed if it were just an array).
  const validLocations = info.locations.filter(
    (l) =>
      l.street_1.trim() && l.city.trim() && l.region.trim() && l.postal_code.trim()
  );
  if (validLocations.length === 0) {
    return NextResponse.json(
      { error: "At least one complete location is required" },
      { status: 400 }
    );
  }
  if (safe.mode === "schedule" && (!safe.assistance_date || !safe.assistance_window)) {
    return NextResponse.json(
      { error: "Assistance call date and time window are required" },
      { status: 400 }
    );
  }

  // Free-text No-PHI scan on the wizard's nested fields. parseBody's
  // phiFields only walks top-level keys, so we scan the nested ones here.
  const phi = scanFieldsForPhi({
    practice_name: info.practice_name,
    description: info.description,
    assistance_notes: safe.assistance_notes,
  });
  if (phi) return NextResponse.json({ error: phi.message }, { status: 422 });

  // Verify membership if updating an existing practice
  let practiceId = existing_practice_id ?? null;
  if (practiceId) {
    const { data: membership } = await db
      .from("practice_users")
      .select("role")
      .eq("practice_id", practiceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const practiceFields: Inserts<"practices"> = {
    name: info.practice_name.trim(),
    description: info.description.trim(),
    employee_range: info.employee_range,
    location_count_range: info.location_count_range,
    current_status: fort.current_status,
    upcoming_audit_window: fort.upcoming_audit_window,
    selected_plan: pay.selected_plan,
    onboarding_step: "completed",
    onboarding_completed_at: new Date().toISOString(),
    hipaa_covered_entity: true,
    frameworks_enabled: ["HIPAA"],
  };

  if (practiceId) {
    const { error: updErr } = await db.from("practices").update(practiceFields).eq("id", practiceId);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  } else {
    const { data: created, error: insErr } = await db
      .from("practices")
      .insert(practiceFields)
      .select("id")
      .single();
    if (insErr || !created) {
      return NextResponse.json({ error: insErr?.message ?? "Failed to create practice" }, { status: 500 });
    }
    practiceId = created.id;

    const { error: puErr } = await db.from("practice_users").insert({
      practice_id: practiceId,
      user_id: user.id,
      role: "owner",
    });
    if (puErr) return NextResponse.json({ error: puErr.message }, { status: 500 });
  }

  await db.from("practice_locations").delete().eq("practice_id", practiceId);
  if (validLocations.length > 0) {
    const { error: locErr } = await db.from("practice_locations").insert(
      validLocations.map((l) => ({
        practice_id: practiceId!,
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

  await db.from("onboarding_integration_choices").delete().eq("practice_id", practiceId);
  if (safe.mode === "manual" && safe.integrations.length > 0) {
    await db.from("onboarding_integration_choices").insert(
      safe.integrations.map((t) => ({ practice_id: practiceId!, integration_type: t }))
    );
  }

  if (safe.mode === "schedule") {
    await db.from("assistance_requests").insert({
      practice_id: practiceId,
      preferred_date: safe.assistance_date || null,
      preferred_time_window: safe.assistance_window || null,
      contact_email: user.email,
      contact_phone: safe.assistance_phone?.trim() || null,
      notes: safe.assistance_notes?.trim() || null,
    });
  }

  // Pre-seed healthcare baseline controls (idempotent)
  const { data: existingPC } = await db
    .from("practice_controls")
    .select("id", { count: "exact", head: true })
    .eq("practice_id", practiceId);
  if (!existingPC || (existingPC as unknown as { length: number }).length === 0) {
    const { data: baseline } = await db
      .from("controls")
      .select("id")
      .eq("healthcare_baseline", true);
    if (baseline?.length) {
      await db.from("practice_controls").insert(
        baseline.map((c) => ({
          practice_id: practiceId!,
          control_id: c.id,
          status: "not_started" as const,
        }))
      );
    }
  }

  await db.from("audit_logs").insert({
    practice_id: practiceId,
    actor_user_id: user.id,
    action: "onboarding.completed",
    resource_type: "practice",
    resource_id: practiceId,
    metadata: sanitizeForAudit({
      plan: pay.selected_plan,
      employee_range: info.employee_range,
      location_count: validLocations.length,
      safeguards_mode: safe.mode,
    }),
  });

  return NextResponse.json({ ok: true, practice_id: practiceId });
}
