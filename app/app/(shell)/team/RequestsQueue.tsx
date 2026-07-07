"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type Role } from "@/lib/auth/permissions";

export interface PendingRequest {
  user_id: string;
  email: string;
  full_name: string;
  job_title: string;
  phone: string | null;
  claimed_admin_name: string | null;
  primary_address: Record<string, string>;
  requested_at: string;
}

export default function RequestsQueue({
  practiceName,
  requests,
}: {
  practiceName: string;
  requests: PendingRequest[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denyForUser, setDenyForUser] = useState<PendingRequest | null>(null);
  const [denyReason, setDenyReason] = useState("");

  if (requests.length === 0) {
    return null;
  }

  async function approve(req: PendingRequest, role: Role) {
    setBusy(req.user_id);
    setError(null);
    try {
      const res = await fetch(`/api/team/requests/${req.user_id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve", role }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Approve failed");
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deny() {
    if (!denyForUser) return;
    setBusy(denyForUser.user_id);
    setError(null);
    try {
      const res = await fetch(`/api/team/requests/${denyForUser.user_id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "deny", denial_reason: denyReason.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Deny failed");
      else {
        setDenyForUser(null);
        setDenyReason("");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl text-[var(--color-primary)]" style={{ letterSpacing: "-0.015em" }}>
          Pending requests
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)]">
          {requests.length} awaiting your review
        </p>
      </div>

      <p className="text-xs text-[var(--color-tertiary)] mb-4">
        These users requested to join <span className="text-[var(--color-primary)]">{practiceName}</span>. Approve to grant
        dashboard access; deny to block their request.
      </p>

      {error && (
        <div className="mb-3 text-[13px] text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {requests.map((r) => (
          <RequestRow
            key={r.user_id}
            req={r}
            busy={busy === r.user_id}
            onApprove={(role) => approve(r, role)}
            onDeny={() => setDenyForUser(r)}
          />
        ))}
      </div>

      {/* Deny modal */}
      {denyForUser && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
          onClick={() => setDenyForUser(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="max-w-md w-full">
          <Card variant="raised">
            <CardBody>
              <h3 className="font-display text-lg text-[var(--color-primary)] mb-1" style={{ letterSpacing: "-0.015em" }}>
                Deny {denyForUser.full_name}?
              </h3>
              <p className="text-xs text-[var(--color-tertiary)] mb-4">
                They&apos;ll see a denial message and won&apos;t be able to access the workspace.
              </p>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tertiary)] mb-1.5 block">
                  Reason (optional)
                </span>
                <textarea
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. We don't recognize this name on our team."
                  className="w-full bg-transparent border border-[var(--color-border-default)] rounded-md p-2.5 text-sm text-[var(--color-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDenyForUser(null)}>Cancel</Button>
                <Button variant="danger" onClick={deny} loading={busy === denyForUser.user_id}>
                  Deny request
                </Button>
              </div>
            </CardBody>
          </Card>
          </div>
        </div>
      )}
    </section>
  );
}

function RequestRow({
  req,
  busy,
  onApprove,
  onDeny,
}: {
  req: PendingRequest;
  busy: boolean;
  onApprove: (role: Role) => void;
  onDeny: () => void;
}) {
  const [role, setRole] = useState<Role>("staff");
  const addr = req.primary_address ?? {};
  const addrLine = [addr.street_1, addr.city, addr.region].filter(Boolean).join(", ");
  const requested = new Date(req.requested_at);
  const requestedLabel = requested.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <Card>
      <CardBody className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <p className="font-medium text-[var(--color-primary)] truncate">{req.full_name}</p>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-quaternary)]">
              {req.job_title}
            </span>
          </div>
          <p className="text-xs text-[var(--color-tertiary)] truncate">
            {req.email}
            {req.phone ? ` · ${req.phone}` : ""}
          </p>
          {addrLine && (
            <p className="text-xs text-[var(--color-quaternary)] truncate mt-0.5">{addrLine}</p>
          )}
          {req.claimed_admin_name && (
            <p className="text-xs text-[var(--color-quaternary)] mt-0.5">
              Claimed admin: <span className="text-[var(--color-tertiary)]">{req.claimed_admin_name}</span>
            </p>
          )}
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-quaternary)] mt-2">
            Requested {requestedLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={busy}
            className="h-9 px-2 bg-transparent border border-[var(--color-border-default)] rounded-md text-sm text-[var(--color-primary)]"
          >
            {ASSIGNABLE_ROLES.filter((r) => r !== "admin").map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <Button variant="primary" size="sm" loading={busy} onClick={() => onApprove(role)}>
            Approve
          </Button>
          <Button variant="ghost" size="sm" onClick={onDeny} disabled={busy}>
            Deny
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
