import Link from "next/link";
import type { AccessState } from "@/lib/billing/access";

/**
 * Practice access banner. Renders only when the practice is in a
 * non-active state — either an expired invite/demo or an unpaid
 * subscription. Pairs with the requirePracticeAccess() server-side gate
 * on mutating routes: this banner tells the user WHY their next click
 * will be blocked, before they click it.
 */
export default function AccessBanner({ state }: { state: AccessState }) {
  if (state.kind === "active") return null;

  if (state.kind === "demo_expired") {
    const when = new Date(state.expired_at).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return (
      <div className="bg-[var(--color-danger)]/10 border-b border-[var(--color-danger)]/30 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[13px] text-[var(--color-primary)]">
          <strong className="text-[var(--color-danger)]">Demo expired</strong>{" "}
          on {when}. You can still view existing data, but new changes are blocked.
        </p>
        <Link
          href="/pricing"
          className="text-[12px] font-mono uppercase tracking-wider px-3 py-1.5 rounded bg-violet-500 text-white hover:bg-violet-400 transition-colors"
        >
          Subscribe to continue
        </Link>
      </div>
    );
  }

  // kind === "unpaid"
  return (
    <div className="bg-[var(--color-warn, #d97706)]/10 border-b border-[var(--color-warn, #d97706)]/30 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-[13px] text-[var(--color-primary)]">
        <strong>No active subscription.</strong> Some actions are disabled until you pick a plan.
      </p>
      <Link
        href="/pricing"
        className="text-[12px] font-mono uppercase tracking-wider px-3 py-1.5 rounded bg-violet-500 text-white hover:bg-violet-400 transition-colors"
      >
        See pricing
      </Link>
    </div>
  );
}
