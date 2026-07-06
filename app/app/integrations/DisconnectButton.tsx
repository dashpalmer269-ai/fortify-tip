"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function DisconnectButton({
  integrationType,
  label,
}: {
  integrationType: string;
  label: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    if (
      !confirm(
        `Disconnect ${label}? Fortify deletes the stored credentials immediately and automated evidence collection for ${label} stops until you reconnect.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_type: integrationType }),
      });
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
    <div className="text-right">
      <button
        onClick={disconnect}
        disabled={busy}
        className="text-[11px] text-[var(--color-tertiary)] hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
      >
        {busy ? "Disconnecting…" : "Disconnect"}
      </button>
      {error && <p className="text-[10px] text-[var(--color-danger)] mt-1">{error}</p>}
    </div>
  );
}
