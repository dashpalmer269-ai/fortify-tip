"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";

export interface PendingInviteRow {
  id: string;
  email: string;
  role: Role;
  created_at: string;
  expires_at: string;
}

/**
 * Admin-only list of outstanding email invitations (practice_invites).
 * Rendered between the join-request queue and the member table so the
 * admin sees everyone "in flight" in one place.
 */
export default function InvitesPanel({ invites }: { invites: PendingInviteRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Snapshot once per mount — expiry display doesn't need to tick live.
  const [now] = useState(() => Date.now());

  if (invites.length === 0) return null;

  async function revoke(invite: PendingInviteRow) {
    if (!confirm(`Revoke the invitation to ${invite.email}? Their link stops working immediately.`)) return;
    setBusyId(invite.id);
    setError(null);
    try {
      const res = await fetch(`/api/invites/${invite.id}/revoke`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(body.error ?? "Failed to revoke invitation");
      else startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mb-6">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-2 px-1">
        Pending invitations
      </h3>
      <Card className="overflow-hidden">
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {invites.map((inv) => {
            const expired = new Date(inv.expires_at).getTime() < now;
            return (
              <div
                key={inv.id}
                className="grid items-center gap-4 px-5 py-3"
                style={{ gridTemplateColumns: "1.5fr 1.2fr 140px 90px" }}
              >
                <p className="font-mono text-[12px] text-[var(--color-primary)] truncate">{inv.email}</p>
                <div>
                  <Badge variant={expired ? "muted" : "info"}>
                    {expired ? "Expired" : ROLE_LABELS[inv.role]}
                  </Badge>
                </div>
                <span className="font-mono text-[11px] text-[var(--color-tertiary)]">
                  {expired ? "expired " : "expires "}
                  {new Date(inv.expires_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </span>
                <div className="text-right">
                  <button
                    onClick={() => revoke(inv)}
                    disabled={busyId === inv.id}
                    className="text-[11px] text-[var(--color-tertiary)] hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
                  >
                    {busyId === inv.id ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {error && <p className="text-xs text-[var(--color-danger)] mt-2 px-1">{error}</p>}
    </div>
  );
}
