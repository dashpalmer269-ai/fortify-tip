/**
 * Practice access state.
 *
 * Three sources of "the practice is allowed to mutate":
 *   - plan_source = 'stripe' AND billing_status active/trialing
 *   - plan_source = 'invite' AND access_expires_at > now()
 *   - (special) the practice is brand-new in the same request (onboarding)
 *
 * Anything else is "demo expired" or "unpaid" — mutating endpoints should
 * return 402 Payment Required and the app shell should show the upgrade
 * banner.
 */
export interface PracticeAccessInput {
  plan_source: string | null;
  access_expires_at: string | null;
  billing_status?: string | null;
}

export type AccessState =
  | { kind: "active"; via: "stripe" | "invite" }
  | { kind: "demo_expired"; expired_at: string }
  | { kind: "unpaid" };

export function computeAccessState(p: PracticeAccessInput): AccessState {
  if (p.plan_source === "stripe") {
    const ok = p.billing_status === "active" || p.billing_status === "trialing";
    return ok ? { kind: "active", via: "stripe" } : { kind: "unpaid" };
  }
  if (p.plan_source === "invite") {
    if (!p.access_expires_at) return { kind: "unpaid" };
    const expires = new Date(p.access_expires_at);
    if (Number.isNaN(expires.getTime())) return { kind: "unpaid" };
    if (expires.getTime() > Date.now()) {
      return { kind: "active", via: "invite" };
    }
    return { kind: "demo_expired", expired_at: p.access_expires_at };
  }
  return { kind: "unpaid" };
}

export function isAccessActive(p: PracticeAccessInput): boolean {
  return computeAccessState(p).kind === "active";
}
