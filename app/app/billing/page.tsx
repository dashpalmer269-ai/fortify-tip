import { getAppSession, assertActive } from "@/lib/auth/session";
import { PLANS, isBillingConfigured } from "@/lib/billing/plans";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getAppSession();
  assertActive(session);

  const configured = isBillingConfigured();

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Workspace"
        title="Billing"
        description="Manage your Fortify subscription, payment method, and invoices."
      />

      {!configured && (
        <Card variant="raised" className="mb-6 p-5">
          <div className="flex items-start gap-3">
            <Badge variant="warning">Setup pending</Badge>
            <div className="flex-1">
              <p className="text-sm text-[var(--color-primary)] mb-1.5">Billing is not yet activated for this workspace.</p>
              <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">
                Stripe is wired and ready, but the account-level keys aren&apos;t in production yet. You can browse the plans below now; checkout becomes live once <span className="font-mono text-[var(--color-secondary)]">STRIPE_SECRET_KEY</span> and <span className="font-mono text-[var(--color-secondary)]">STRIPE_PRICE_*</span> are set in Vercel.
              </p>
            </div>
          </div>
        </Card>
      )}

      <section className="space-y-3 mb-10">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-1">
                Current plan
              </p>
              <p className="text-[var(--color-primary)] text-base">Free trial</p>
              <p className="text-xs text-[var(--color-tertiary)] mt-0.5">14-day trial · no credit card on file</p>
            </div>
            <Badge variant="accent">Trial</Badge>
          </div>
        </Card>
      </section>

      <h2 className="font-display text-xl text-[var(--color-primary)] mb-4" style={{ letterSpacing: "-0.02em" }}>
        Plans
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLANS.map((p) => (
          <Card key={p.id} className="p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[var(--color-primary)] text-sm font-medium">{p.name}</p>
              {p.badge && <Badge variant="accent">{p.badge}</Badge>}
            </div>
            <p className="text-[11px] text-[var(--color-tertiary)] mb-3">{p.description}</p>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="font-display text-2xl text-[var(--color-primary)] tabular-nums" style={{ letterSpacing: "-0.02em" }}>
                ${p.monthly_price_usd.toLocaleString()}
              </span>
              <span className="text-xs text-[var(--color-tertiary)]">/mo</span>
            </div>
            <ButtonLink href="/pricing" variant="secondary" size="sm" className="w-full">
              {configured ? "Choose plan" : "See details"}
            </ButtonLink>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-xs text-[var(--color-quaternary)] font-mono">
        Invoices, payment methods, and downgrades will appear here once a paid plan is active.
      </p>
    </div>
  );
}
