"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function ActivateButton({ policyId }: { policyId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policyId}/activate`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="text-sm text-[var(--color-primary)] mb-0.5">This policy is a draft.</p>
        <p className="text-xs text-[var(--color-tertiary)]">
          Review the text above, then activate it. Once active, your workforce can acknowledge
          it and the acknowledgment requirement starts counting toward readiness.
        </p>
      </div>
      <div className="text-right">
        <Button onClick={activate} loading={busy} variant="primary" size="sm">
          Activate policy
        </Button>
        {error && <p className="text-xs text-[var(--color-danger)] mt-1.5">{error}</p>}
      </div>
    </div>
  );
}
