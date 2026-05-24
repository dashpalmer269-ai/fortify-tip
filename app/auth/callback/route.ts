import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { sendEmail } from "@/lib/email/provider";
import { welcomeEmail } from "@/lib/email/templates";

/**
 * Post-verification + magic-link + OAuth callback.
 * Exchanges code → session, fires welcome email (no-op without RESEND key),
 * routes the user into onboarding or the dashboard depending on practice state.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createAuthedServerClient();
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  // Fire welcome email (best-effort)
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

  // Honor explicit `?next=` redirect when present
  if (next) return NextResponse.redirect(`${origin}${next}`);

  // Otherwise route based on practice/onboarding state
  const { data: membership } = await supabase
    .from("practice_users")
    .select("practice_id, practices(onboarding_step)")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.redirect(`${origin}/app/onboarding`);
  }
  const step = (membership.practices as unknown as { onboarding_step?: string } | null)?.onboarding_step;
  if (!step || step === "completed") {
    return NextResponse.redirect(`${origin}/app`);
  }
  return NextResponse.redirect(`${origin}/app/onboarding`);
}
