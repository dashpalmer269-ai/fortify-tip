"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * "I acknowledge" button for the policy detail page. Shows the existing
 * acknowledgment timestamp if the user has already acked this version,
 * otherwise lets them ack it now (which also auto-resolves the matching
 * policy_ack task on their punch list).
 */
export default function AckButton({
  policyId,
  policyVersion,
  initialAcknowledgedAt,
}: {
  policyId: string;
  policyVersion: number;
  initialAcknowledgedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(initialAcknowledgedAt);

  async function acknowledge() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/policies/${policyId}/acknowledge`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; acknowledged_at?: string };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setAcknowledgedAt(body.acknowledged_at ?? new Date().toISOString());
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (acknowledgedAt) {
    return (
      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-secondary)]">
        <strong className="text-[var(--color-success)]">Acknowledged.</strong>{" "}
        You acknowledged version {policyVersion} of this policy on{" "}
        {new Date(acknowledgedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] px-4 py-4 space-y-3">
      <p className="text-sm text-[var(--color-secondary)] leading-relaxed">
        By acknowledging, you confirm that you have read and understand version {policyVersion} of this
        policy and agree to comply with its contents. Your acknowledgment is recorded with the timestamp
        and your account identity, and your matching task on the workspace punch list will be marked done.
      </p>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <Button onClick={acknowledge} loading={busy} variant="primary" size="sm">
        I acknowledge this policy
      </Button>
    </div>
  );
}
