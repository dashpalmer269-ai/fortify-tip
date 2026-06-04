"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function CompleteButton({
  moduleId,
  moduleTitle,
  initialCompletedAt,
  initialExpiresOn,
}: {
  moduleId: string;
  moduleTitle: string;
  initialCompletedAt: string | null;
  initialExpiresOn: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(initialCompletedAt);
  const [expiresOn, setExpiresOn] = useState<string | null>(initialExpiresOn);

  const today = new Date().toISOString().slice(0, 10);
  const current = completedAt && expiresOn && expiresOn >= today;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/training/${moduleId}/complete`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        completed_at?: string;
        expires_on?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setCompletedAt(body.completed_at ?? new Date().toISOString());
      setExpiresOn(body.expires_on ?? null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (current) {
    return (
      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-secondary)]">
        <strong className="text-[var(--color-success)]">Completed.</strong>{" "}
        You completed {moduleTitle} on{" "}
        {new Date(completedAt!).toLocaleString("en-US", { dateStyle: "long" })}
        {expiresOn && <> · expires {new Date(expiresOn).toLocaleDateString("en-US", { dateStyle: "long" })}</>}.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] px-4 py-4 space-y-3">
      {completedAt && !current && (
        <p className="text-xs text-[var(--color-danger)]">
          Your previous completion expired on {expiresOn}. Please complete this training again to stay current.
        </p>
      )}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-violet-500"
        />
        <span className="text-sm text-[var(--color-secondary)] leading-relaxed">
          I have read and understood this training. I will apply the practices it describes to my work.
        </span>
      </label>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <Button onClick={submit} disabled={!acknowledged || busy} loading={busy} variant="primary" size="sm">
        Record completion
      </Button>
    </div>
  );
}
