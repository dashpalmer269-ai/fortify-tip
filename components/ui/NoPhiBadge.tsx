/**
 * Persistent NO-PHI classification badge — a constant visual reminder
 * that Fortify is configured to not receive Protected Health Information.
 * Hover/focus reveals the full architecture statement.
 *
 * Mounted in the app top bar so it appears on every authenticated page.
 */

export default function NoPhiBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-md border"
      style={{
        background: "color-mix(in srgb, var(--color-success) 8%, transparent)",
        color: "var(--color-success)",
        borderColor: "color-mix(in srgb, var(--color-success) 30%, transparent)",
      }}
      title="Fortify is configured to never receive, store, or transmit Protected Health Information. Enforced at four runtime layers: AI prompt, API schema scan, database CHECK constraint, and this UI badge."
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" />
      </svg>
      NO PHI
    </span>
  );
}
