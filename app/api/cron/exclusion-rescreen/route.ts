import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { startPreliminary } from "@/lib/screening/service";
import { sendEmail } from "@/lib/email/provider";
import { workforceRescreenBlockedEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const maxDuration = 600;

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

/**
 * Rolling 28-day re-screen.
 *
 * Picks workforce members whose latest screening has expired (or who have
 * no screening yet) and re-runs the preliminary check using stored
 * user_profiles.{first_name,last_name,date_of_birth}. On a fresh block,
 * notifies practice admins by email + in-app and flips user_profiles.status
 * to 'denied' with reason 'periodic_screening_block'.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const origin = new URL(req.url).origin;

  // Find every approved workforce member whose latest screening expired or is missing.
  // Doing this in two steps because we can't easily join the view + profiles in one round trip.
  const { data: dueRows } = await db
    .from("user_profiles")
    .select("user_id, first_name, last_name, date_of_birth, full_name")
    .eq("status", "approved")
    .not("first_name", "is", null)
    .not("last_name", "is", null)
    .not("date_of_birth", "is", null)
    .limit(500);

  let rescreened = 0;
  let cleared = 0;
  let newlyBlocked = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const profile of dueRows ?? []) {
    if (!profile.first_name || !profile.last_name || !profile.date_of_birth) {
      skipped++;
      continue;
    }

    // Resolve practice membership
    const { data: membership } = await db
      .from("practice_users")
      .select("practice_id")
      .eq("user_id", profile.user_id)
      .limit(1)
      .maybeSingle();
    if (!membership) {
      skipped++;
      continue;
    }

    // Latest screening currency check
    const { data: latest } = await db
      .from("exclusion_screenings")
      .select("expires_at, status")
      .eq("subject_user_id", profile.user_id)
      .eq("subject_type", "workforce_member")
      .order("screened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const stillCurrent =
      latest &&
      (latest.status === "cleared" || latest.status === "overridden_clear") &&
      latest.expires_at &&
      new Date(latest.expires_at).getTime() > Date.now();
    if (stillCurrent) {
      skipped++;
      continue;
    }

    try {
      const result = await startPreliminary(db, {
        subjectType: "workforce_member",
        subjectUserId: profile.user_id,
        practiceId: membership.practice_id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        dateOfBirth: profile.date_of_birth,
      });
      rescreened++;

      if (result.status === "cleared") {
        cleared++;
      } else if (result.status === "review_required") {
        // Tier-1 hit during periodic rescreen. Suspend defensively and
        // notify admins to chase the workforce member for verification.
        newlyBlocked++;
        await db
          .from("user_profiles")
          .update({
            status: "denied",
            denial_reason: "periodic_screening_review_pending",
            decided_at: new Date().toISOString(),
          })
          .eq("user_id", profile.user_id);

        const { data: admins } = await db
          .from("practice_users")
          .select("user_id")
          .eq("practice_id", membership.practice_id)
          .in("role", ["owner", "admin"]);

        if (admins?.length) {
          const memberName = profile.full_name ?? `${profile.first_name} ${profile.last_name}`;
          await db.from("notifications").insert(
            admins.map((a) => ({
              user_id: a.user_id,
              practice_id: membership.practice_id,
              kind: "screening.rescreen_blocked",
              title: `${memberName}: verification needed`,
              body: "Workspace access paused while their compliance verification re-runs.",
              link: "/app/team",
            }))
          );
          const adminEmails: string[] = [];
          for (const a of admins) {
            const { data: u } = await db.auth.admin.getUserById(a.user_id);
            if (u.user?.email) adminEmails.push(u.user.email);
          }
          if (adminEmails.length > 0) {
            await sendEmail({
              to: adminEmails,
              subject: `Compliance verification paused access for ${memberName}`,
              html: workforceRescreenBlockedEmail({
                practice_id: membership.practice_id,
                member_name: memberName,
                app_url: origin,
              }),
              tag: "screening.rescreen_blocked",
            });
          }
        }
      }
    } catch (e) {
      errors.push(`${profile.user_id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    rescreened,
    cleared,
    newly_blocked: newlyBlocked,
    skipped,
    errors,
  });
}
