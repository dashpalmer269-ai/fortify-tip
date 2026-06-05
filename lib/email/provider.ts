/**
 * Email provider abstraction.
 *
 * If RESEND_API_KEY is set we call the Resend HTTP API directly (no SDK needed,
 * just fetch). If unset, we no-op gracefully and log so dev mode doesn't break
 * onboarding before the email account is wired up.
 *
 * To enable: get a Resend API key (https://resend.com), then
 *   1) add RESEND_API_KEY to Vercel + .env.local
 *   2) verify a sending domain (fortifynow.xyz) and set RESEND_FROM_EMAIL
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  tag?: string;        // for delivery analytics
}

export interface SendResult {
  ok: boolean;
  provider: "resend" | "noop";
  id?: string;
  error?: string;
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Fortify <noreply@fortifynow.xyz>";

  if (!apiKey) {
    console.log(`[email:noop] skipping ${msg.subject} -> ${stringifyRecipients(msg.to)}`);
    return { ok: true, provider: "noop" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        reply_to: msg.reply_to,
        tags: msg.tag ? [{ name: "category", value: msg.tag }] : undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, provider: "resend", error: body.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, provider: "resend", id: body.id };
  } catch (e) {
    return { ok: false, provider: "resend", error: (e as Error).message };
  }
}

function stringifyRecipients(to: string | string[]): string {
  return Array.isArray(to) ? to.join(",") : to;
}
