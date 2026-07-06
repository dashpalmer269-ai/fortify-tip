import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { createServerClient as createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/provider";
import { welcomeEmail } from "@/lib/email/templates";
import { redeemPendingInviteByEmail } from "@/lib/billing/team-invites";

/**
 * Post-verification + magic-link + OAuth callback.
 * Exchanges code → session, fires welcome email (no-op without RESEND key),
 * routes the user into onboarding / pending / dashboard based on state.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const accountTypeParam = searchParams.get("account_type");

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createAuthedServerClient();
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  // For OAuth signups, the account_type came via query param, not signUp().
  // Persist it to user_metadata if not already set.
  const existingMeta = data.user.user_metadata?.account_type;
  if (!existingMeta && (accountTypeParam === "admin" || accountTypeParam === "employee")) {
    try {
      await supabase.auth.updateUser({ data: { account_type: accountTypeParam } });
    } catch {
      /* don't block sign-in if metadata write fails */
    }
  }
  const accountType: "admin" | "employee" =
    (existingMeta as "admin" | "employee" | undefined) ??
    (accountTypeParam === "employee" ? "employee" : "admin");

  if (data.user.email) {
    try {
      await sendEmail({
        to: data.user.email,
        subject: "Welcome to Fortify",
        html: welcomeEmail({ email: data.user.email, appUrl: origin }),
        tag: "welcome",
      });
    } catch {
      /* email failure must not block sign-up */
    }
  }

  // Team-invite silent redemption: if this verified email was invited to a
  // practice (migration 048), join them now — the membership query below
  // then routes them straight into the app, skipping the join-request queue.
  if (data.user.email) {
    const service = createServiceClient();
    if (service) {
      await redeemPendingInviteByEmail(service, { id: data.user.id, email: data.user.email });
    }
  }

  // Honor explicit `?next=` redirect when present
  if (next) return NextResponse.redirect(`${origin}${next}`);

  const { data: membership } = await supabase
    .from("practice_users")
    .select("practice_id, practices(onboarding_step)")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle()
    .returns<{ practice_id: string; practices: { onboarding_step: string | null } | null } | null>();

  if (membership) {
    const step = membership.practices?.onboarding_step;
    if (!step || step === "completed") {
      return NextResponse.redirect(`${origin}/app`);
    }
    return NextResponse.redirect(`${origin}/app/onboarding`);
  }

  // No membership yet — split on account_type for employees who already submitted.
  if (accountType === "employee") {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("onboarded_at")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (profile?.onboarded_at) {
      return NextResponse.redirect(`${origin}/pending`);
    }
  }

  return NextResponse.redirect(`${origin}/app/onboarding`);
}
