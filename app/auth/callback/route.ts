import { NextRequest, NextResponse } from "next/server";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { sendEmail } from "@/lib/email/provider";
import { welcomeEmail } from "@/lib/email/templates";

/**
 * Email-verification + magic-link callback.
 * Supabase redirects here with ?code=… after the user clicks the email link.
 * On first verification we fire a welcome email (no-ops if RESEND_API_KEY is unset).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app/onboarding/new-practice";

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createAuthedServerClient();
  const { error, data } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.user) {
    return NextResponse.redirect(`${origin}/login?error=callback_failed`);
  }

  // Fire welcome email (best-effort, no await blocking the redirect for too long)
  if (data.user.email) {
    try {
      await sendEmail({
        to: data.user.email,
        subject: "Welcome to Fortify",
        html: welcomeEmail({ email: data.user.email, appUrl: origin }),
        tag: "welcome",
      });
    } catch {
      // Swallow — email failure must not block sign-up
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
