"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface PendingInvite {
  email: string;
  role: "admin" | "compliance_officer" | "staff" | "auditor_readonly";
}

const ROLE_LABELS: Record<PendingInvite["role"], string> = {
  admin: "Admin",
  compliance_officer: "Compliance Officer",
  staff: "Staff",
  auditor_readonly: "External Auditor (read-only)",
};

export default function InviteForm({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<PendingInvite["role"]>("staff");
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || invites.some((i) => i.email === trimmed)) return;
    setInvites((prev) => [...prev, { email: trimmed, role }]);
    setEmail("");
  }
  function removeInvite(emailToRemove: string) {
    setInvites((prev) => prev.filter((i) => i.email !== emailToRemove));
  }

  async function finishOnboarding() {
    setError(null);
    setSubmitting(true);
    try {
      if (invites.length > 0) {
        const res = await fetch("/api/invites/queue", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ practice_id: practiceId, invites }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Failed to queue invites.");
          return;
        }
      }
      router.push("/app");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <form onSubmit={addInvite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@practice.com" className="inv-input"
              />
              <select
                value={role} onChange={(e) => setRole(e.target.value as PendingInvite["role"])}
                className="inv-input"
              >
                {(Object.keys(ROLE_LABELS) as PendingInvite["role"][]).map((r) => (
                  <option key={r} value={r} className="bg-black">{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={!email.trim()} variant="secondary" size="sm">
              + Add invite
            </Button>
          </form>

          <style>{`
            .inv-input { width:100%; height:38px; background:transparent;
              border:1px solid var(--color-border-default); border-radius:6px;
              padding:0 10px; color:var(--color-primary); font-size:14px;
              transition:border-color 150ms ease; }
            .inv-input:focus { border-color: var(--color-accent); outline:none; }
          `}</style>
        </CardBody>
      </Card>

      {invites.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-2">
            Queued ({invites.length})
          </p>
          <Card className="overflow-hidden">
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {invites.map((i) => (
                <div key={i.email} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-primary)]">{i.email}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)] mt-0.5">
                      {ROLE_LABELS[i.role]}
                    </p>
                  </div>
                  <button onClick={() => removeInvite(i.email)} className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)] hover:text-[var(--color-danger)] transition-colors">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <p className="text-xs text-[var(--color-tertiary)] leading-relaxed px-1">
        Invitations are queued and will be emailed once the email provider is connected. Until then, share your practice link directly with teammates and have them sign up.
      </p>

      {error && (
        <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">{error}</div>
      )}

      <Button onClick={finishOnboarding} loading={submitting} variant="primary" size="lg" className="w-full">
        Enter Fortify →
      </Button>
    </div>
  );
}
