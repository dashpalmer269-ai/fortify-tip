"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/billing/plans";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

export default function PricingCard({ plan, featured }: { plan: Plan; featured?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan_id: plan.id }),
      });
      const body = await res.json();
      if (res.status === 401) {
        router.push(`/signup?plan=${plan.id}`);
        return;
      }
      if (!res.ok) {
        setError(body.next_step ?? body.error ?? "Could not start checkout.");
        return;
      }
      if (body.url) window.location.href = body.url;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card variant={featured ? "raised" : "default"} className="p-6 h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-display text-xl text-[var(--color-primary)]" style={{ letterSpacing: "-0.015em" }}>
          {plan.name}
        </h3>
        {plan.badge && <Badge variant="accent">{plan.badge}</Badge>}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-5">
        {plan.description}
      </p>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="font-display text-4xl text-[var(--color-primary)] tabular-nums" style={{ letterSpacing: "-0.025em" }}>
          ${plan.monthly_price_usd.toLocaleString()}
        </span>
        <span className="text-sm text-[var(--color-tertiary)]">/mo</span>
      </div>
      <ul className="space-y-2.5 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="text-sm text-[var(--color-secondary)] flex gap-2.5">
            <span className="text-[var(--color-accent)] mt-0.5 shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button
        onClick={startCheckout}
        loading={loading}
        variant={featured ? "primary" : "secondary"}
        size="md"
        className="w-full"
      >
        Sign Up
      </Button>
      {error && <p className="text-xs text-[var(--color-danger)] mt-2 text-center">{error}</p>}
    </Card>
  );
}
