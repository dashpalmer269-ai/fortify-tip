import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient } from "@/lib/supabase/server";
import { sanitizeForAudit, scanFieldsForPhi } from "@/lib/compliance/no-phi";
import { OnboardingFinalizeSchema, parseBody } from "@/lib/schemas/api";
import type { Inserts } from "@/lib/supabase/types";

/**
 * Finalize onboarding — creates the practice + the founder's
 * practice_users row + initial controls/safeguards.
 *
 * Service-role usage justification:
 *   The user has no practice_users membership at this point (we're
 *   creating the practice for the first time). RLS on `practices` and
 *   `practice_users` requires membership the user doesn't yet have.
 *   Service-role is the correct pattern for bootstrap operations.
 *
 * Safety invariants verified in this handler:
 *   - user.id is pulled from the authenticated JWT, never from the body
 *   - The founder's practice_users row pins user_id = auth.uid()
 *   - All audit_log entries pin actor_user_id = auth.uid()
 *   - Free-text fields scanned for PHI via scanFieldsForPhi before write
 *   - If existing_practice_id is supplied, membership is verified before
 *     any update path proceeds
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

  // ── Invite redemption ──────────────────────────────────────────────────
  // The signup page stashed the invite code in user_metadata.invite_code
  // (it survives the email-confirm round trip; URL params don't). Redeem
  // atomically: bump used_count, insert redemption, set practice's
  // access_expires_at + plan_source.
  const inviteCode = typeof user.user_metadata?.invite_code === "string"
    ? user.user_metadata.invite_code
    : null;

  let demoMinutes: number | null = null;
  if (inviteCode && !existing_practice_id) {
    const { data: code } = await db
      .from("invite_codes")
      .select("id, access_duration_minutes, used_count, max_uses, link_expires_at, revoked_at")
      .eq("code", inviteCode)
      .maybeSingle();

    const valid =
      code &&
      !code.revoked_at &&
      code.used_count < code.max_uses &&
      new Date(code.link_expires_at).getTime() > Date.now();

    if (valid && code) {
      const now = Date.now();
      const expiresAt = new Date(now + code.access_duration_minutes * 60 * 1000).toISOString();
      // Increment used_count by selecting + updating (Supabase JS doesn't have atomic increment;
      // a unique (code_id, user_id) constraint on invite_redemptions prevents double-grant per user).
      const { error: redErr } = await db.from("invite_redemptions").insert({
        code_id: code.id,
        user_id: user.id,
        practice_id: practiceId!,
        access_expires_at: expiresAt,
      });
      if (!redErr) {
        await db.from("invite_codes").update({ used_count: code.used_count + 1 }).eq("id", code.id);
        await db.from("practices").update({
          plan_source: "invite",
          access_expires_at: expiresAt,
        }).eq("id", practiceId!);
        demoMinutes = code.access_duration_minutes;
        await db.from("audit_logs").insert({
          practice_id: practiceId,
          actor_user_id: user.id,
          action: "invite.redeemed",
          resource_type: "invite_code",
          resource_id: code.id,
          metadata: { access_duration_minutes: code.access_duration_minutes },
        });
      }
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
      demo_minutes: demoMinutes,
    }),
  });

  return NextResponse.json({ ok: true, practice_id: practiceId, demo_minutes: demoMinutes });
}
