"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/billing/plans";

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
        // Not signed in — send to signup with intended plan
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
    <div
      className="glass-card rounded-2xl p-6"
      style={{
        boxShadow: featured ? "0 0 32px rgba(139,92,246,0.4)" : undefined,
        borderColor: featured ? "rgba(139,92,246,0.5)" : undefined,
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
        {plan.badge && (
          <span className="text-[10px] uppercase tracking-wider text-violet-300 px-2 py-0.5 rounded-full bg-violet-500/15">
            {plan.badge}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">{plan.description}</p>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-3xl font-black text-white tabular-nums">${plan.monthly_price_usd.toLocaleString()}</span>
        <span className="text-sm text-gray-500">/month</span>
      </div>
      <ul className="space-y-2 mb-6 min-h-[14rem]">
        {plan.features.map((f) => (
          <li key={f} className="text-sm text-gray-300 flex gap-2">
            <span className="text-violet-400 mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={startCheckout}
        disabled={loading}
        className={`w-full text-center text-sm font-medium rounded-lg px-4 py-2.5 transition-colors ${
          featured
            ? "bg-violet-500 hover:bg-violet-400 text-white"
            : "border border-white/15 hover:border-violet-400/40 text-white"
        }`}
      >
        {loading ? "Starting checkout…" : "Start free trial"}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
