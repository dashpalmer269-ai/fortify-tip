"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    if (!trimmed) return;
    if (invites.some((i) => i.email === trimmed)) return;
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
      // Real email-based invites need a transactional email provider (Phase E).
      // For now, persist the pending invites to a queue table; they'll be sent
      // when the email integration lands.
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
      <form onSubmit={addInvite} className="glass-card rounded-2xl p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@practice.com"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as PendingInvite["role"])}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:border-violet-400 focus:outline-none"
          >
            {(Object.keys(ROLE_LABELS) as PendingInvite["role"][]).map((r) => (
              <option key={r} value={r} className="bg-black">
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!email.trim()}
          className="w-full sm:w-auto border border-violet-400/40 text-violet-300 hover:bg-violet-500/10 disabled:opacity-40 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          + Add invite
        </button>
      </form>

      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-gray-500">Queued invites ({invites.length})</p>
          {invites.map((i) => (
            <div key={i.email} className="glass-card rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{i.email}</p>
                <p className="text-xs text-gray-500">{ROLE_LABELS[i.role]}</p>
              </div>
              <button
                onClick={() => removeInvite(i.email)}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 px-4 py-3 text-xs text-gray-400">
        Invitations are queued and will be emailed automatically once the email provider is connected. Until then, share your practice link directly with teammates and have them sign up.
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        onClick={finishOnboarding}
        disabled={submitting}
        className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-medium rounded-lg px-4 py-3 transition-colors"
        style={{ boxShadow: "0 0 24px rgba(139,92,246,0.4)" }}
      >
        {submitting ? "Finishing setup…" : "Enter Fortify →"}
      </button>
    </div>
  );
}
