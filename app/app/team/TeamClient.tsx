"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  isAdmin,
  isOwner,
  type Role,
} from "@/lib/auth/permissions";
import type { TeamMember } from "./page";

interface Props {
  practiceId: string;
  currentRole: Role;
  members: TeamMember[];
}

const ROLE_VARIANT: Record<Role, "accent" | "info" | "success" | "warning" | "muted"> = {
  owner: "accent",
  admin: "info",
  compliance_officer: "success",
  staff: "muted",
  auditor_readonly: "warning",
};

export default function TeamClient({ practiceId, currentRole, members }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const canManage = isAdmin(currentRole);
  const canPromoteToOwner = isOwner(currentRole);

  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-[var(--color-tertiary)]">
            {members.length} {members.length === 1 ? "member" : "members"} ·{" "}
            <span className="text-[var(--color-secondary)]">
              You are a {ROLE_LABELS[currentRole]}
            </span>
          </p>
          <Button onClick={() => setAddOpen(!addOpen)} variant="primary" size="md">
            {addOpen ? "Close" : "Add member"}
          </Button>
        </div>
      )}

      {canManage && addOpen && (
        <AddMemberForm
          practiceId={practiceId}
          onAdded={() => {
            setAddOpen(false);
            startTransition(() => router.refresh());
          }}
        />
      )}

      <Card className="overflow-hidden">
        <div
          className="grid items-center gap-4 px-5 py-3 border-b border-[var(--color-border-subtle)] font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)]"
          style={{ gridTemplateColumns: "1.5fr 1.2fr 100px 140px" }}
        >
          <div>Member</div>
          <div>Role</div>
          <div>Joined</div>
          <div className="text-right">Actions</div>
        </div>
        <div className="divide-y divide-[var(--color-border-subtle)]">
          {members.map((m) => (
            <MemberRow
              key={m.user_id}
              member={m}
              practiceId={practiceId}
              canManage={canManage}
              canPromoteToOwner={canPromoteToOwner}
              onChange={() => startTransition(() => router.refresh())}
            />
          ))}
        </div>
      </Card>

      {!canManage && (
        <p className="text-xs text-[var(--color-tertiary)] px-1">
          Only the practice Owner or an Admin can add, remove, or change member roles.
        </p>
      )}
    </div>
  );
}

/* ─────────── Add member form ─────────── */

function AddMemberForm({
  practiceId,
  onAdded,
}: {
  practiceId: string;
  onAdded: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [inviteOffer, setInviteOffer] = useState<{ email: string; role: Role } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setHint(null);
    setInviteOffer(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practice_id: practiceId, email: email.trim(), role }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.signup_required) {
          // No account yet — offer the email-invite path instead.
          setInviteOffer({ email: email.trim().toLowerCase(), role });
        } else {
          setError(body.error ?? "Failed to add member");
        }
        return;
      }
      setEmail("");
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function sendInvite() {
    if (!inviteOffer) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/invites/queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          practice_id: practiceId,
          invites: [{ email: inviteOffer.email, role: inviteOffer.role }],
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        queued?: number;
        skipped?: Array<{ email: string; reason: string }>;
      };
      if (!res.ok) {
        setError(body.error ?? "Failed to send invitation");
        return;
      }
      if (body.queued === 0) {
        const reason = body.skipped?.[0]?.reason;
        setError(
          reason === "already_invited"
            ? "They already have a pending invitation — see the list above."
            : reason === "send_failed"
              ? "The invitation was created but the email failed to send. They can still be re-invited later."
              : "Could not send the invitation."
        );
        return;
      }
      setHint(`Invitation sent to ${inviteOffer.email}. It expires in 14 days.`);
      setInviteOffer(null);
      setEmail("");
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card variant="raised">
      <CardBody>
        <h3
          className="font-display text-lg text-[var(--color-primary)] mb-1"
          style={{ letterSpacing: "-0.015em" }}
        >
          Add a member
        </h3>
        <p className="text-xs text-[var(--color-tertiary)] mb-5">
          If they already have a Fortify account they get access immediately — otherwise
          we&apos;ll email them an invitation to join this practice.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@practice.com"
                className="team-input"
              />
            </Field>
            <Field label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="team-input"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r} className="bg-black">
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">
            {ROLE_DESCRIPTIONS[role]}
          </p>

          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          {hint && (
            <div className="text-sm text-[var(--color-accent)] bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 rounded-md px-3 py-2">
              {hint}
            </div>
          )}
          {inviteOffer && (
            <div className="text-sm bg-[var(--color-accent-soft)] border border-[var(--color-accent)]/30 rounded-md px-3 py-3 space-y-2">
              <p className="text-[var(--color-secondary)]">
                {inviteOffer.email} doesn&apos;t have a Fortify account yet.
              </p>
              <Button type="button" onClick={sendInvite} loading={submitting} variant="primary" size="sm">
                Email them an invitation
              </Button>
            </div>
          )}

          <Button type="submit" loading={submitting} variant="primary" size="md">
            Add to practice
          </Button>
        </form>

        <style>{`
          .team-input {
            width: 100%; height: 36px; background: transparent;
            border: 1px solid var(--color-border-default); border-radius: 6px;
            padding: 0 10px; color: var(--color-primary); font-size: 13px;
            transition: border-color 150ms ease;
          }
          .team-input:focus { border-color: var(--color-accent); outline: none; }
        `}</style>
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ─────────── Member row with inline actions ─────────── */

function MemberRow({
  member,
  practiceId,
  canManage,
  canPromoteToOwner,
  onChange,
}: {
  member: TeamMember;
  practiceId: string;
  canManage: boolean;
  canPromoteToOwner: boolean;
  onChange: () => void;
}) {
  const [editingRole, setEditingRole] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(member.full_name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) { setError("Name can't be empty"); return; }
    if (trimmed === (member.full_name ?? "")) { setEditingName(false); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/team/name", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          practice_id: practiceId,
          target_user_id: member.user_id,
          full_name: trimmed,
        }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Failed to update name");
      else {
        setEditingName(false);
        onChange();
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(newRole: Role) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/team/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          practice_id: practiceId,
          target_user_id: member.user_id,
          new_role: newRole,
        }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Failed to change role");
      else {
        setEditingRole(false);
        onChange();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Remove ${member.email} from the practice? They will lose all access immediately.`
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/team/remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practice_id: practiceId, target_user_id: member.user_id }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error ?? "Failed to remove");
      else onChange();
    } finally {
      setBusy(false);
    }
  }

  const roleOptions: Role[] = canPromoteToOwner
    ? ["owner", "admin", "compliance_officer", "staff", "auditor_readonly"]
    : ["admin", "compliance_officer", "staff", "auditor_readonly"];

  return (
    <div
      className="grid items-center gap-4 px-5 py-3 hover:bg-[var(--color-surface-raised)] transition-colors"
      style={{ gridTemplateColumns: "1.5fr 1.2fr 100px 140px" }}
    >
      <div className="min-w-0">
        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") { setEditingName(false); setNameDraft(member.full_name ?? ""); }
              }}
              disabled={busy}
              maxLength={120}
              className="bg-transparent border border-[var(--color-accent)]/60 rounded-md px-2 py-0.5 text-sm text-[var(--color-primary)] focus:outline-none w-full"
            />
            <button
              onClick={saveName}
              disabled={busy}
              className="text-[11px] text-[var(--color-accent)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50 shrink-0"
            >
              Save
            </button>
            <button
              onClick={() => { setEditingName(false); setNameDraft(member.full_name ?? ""); setError(null); }}
              disabled={busy}
              className="text-[11px] text-[var(--color-quaternary)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50 shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm text-[var(--color-primary)] truncate">
              {member.full_name || <span className="italic text-[var(--color-tertiary)]">No name set</span>}
              {member.is_self && <span className="ml-2 text-xs text-[var(--color-tertiary)]">(you)</span>}
            </p>
            {canManage && (
              <button
                onClick={() => setEditingName(true)}
                disabled={busy}
                aria-label="Edit name"
                className="text-[var(--color-quaternary)] hover:text-[var(--color-primary)] transition-colors shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            )}
          </div>
        )}
        <p className="font-mono text-[10px] text-[var(--color-quaternary)] mt-0.5 truncate">
          {member.email}
        </p>
      </div>

      <div>
        {editingRole ? (
          <select
            defaultValue={member.role}
            onChange={(e) => changeRole(e.target.value as Role)}
            disabled={busy}
            className="bg-transparent border border-[var(--color-border-default)] rounded-md px-2 py-1 text-xs text-[var(--color-primary)]"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r} className="bg-black">
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        ) : (
          <Badge variant={ROLE_VARIANT[member.role]}>{ROLE_LABELS[member.role]}</Badge>
        )}
        {error && <p className="text-[10px] text-[var(--color-danger)] mt-1">{error}</p>}
      </div>

      <span className="font-mono text-[11px] text-[var(--color-tertiary)]">
        {member.joined_at ? new Date(member.joined_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}
      </span>

      <div className="flex items-center gap-2 justify-end">
        {canManage && !member.is_self && (
          <>
            <button
              onClick={() => setEditingRole((s) => !s)}
              disabled={busy}
              className="text-[11px] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
            >
              {editingRole ? "Cancel" : "Change role"}
            </button>
            <span className="text-[var(--color-quaternary)]">·</span>
            <button
              onClick={remove}
              disabled={busy}
              className="text-[11px] text-[var(--color-tertiary)] hover:text-[var(--color-danger)] transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </>
        )}
        {member.is_self && (
          <span className="text-[11px] text-[var(--color-quaternary)]">—</span>
        )}
      </div>
    </div>
  );
}
