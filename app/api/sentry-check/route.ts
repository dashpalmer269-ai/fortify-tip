/**
 * Sentry verification endpoint.
 *
 * Admin-only. Captures a known error tagged with a UUID so the operator can
 * find it on the Sentry issue list. Returns 200 with { sent: true, ref } —
 * the SDK flush is best-effort but we wait up to 2s to give it a chance
 * before responding.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAppSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAppSession();
  if (session.kind !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.membership.role;
  if (!["admin", "officer", "owner"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ref = crypto.randomUUID();
  try {
    throw new Error(`fortify.sentry-check::${ref}`);
  } catch (err) {
    Sentry.captureException(err, {
      tags: {
        route: "/api/sentry-check",
        verification: "true",
        ref,
      },
    });
    await Sentry.flush(2000);
    return NextResponse.json({
      sent: true,
      ref,
      next_step: "Find this ref in Sentry → Issues. If you see it, capture is live.",
    });
  }
}
