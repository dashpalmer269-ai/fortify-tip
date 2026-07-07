"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

interface InviteRedemption {
  redeemed_at: string;
  access_expires_at: string;
  user_id: string;
}

interface InviteCode {
  id: string;
  // url + plaintext code are NOT present on list responses — they only
  // appear in the POST /api/admin/invites response when the code is first
  // generated (because the DB stores only sha256(code), per migration 042).
  access_duration_minutes: number;
  used_count: number;
  max_uses: number;
  link_expires_at: string;
  revoked_at: string | null;
  note: string | null;
  granted_at: string;
  redemptions: InviteRedemption[];
}

export default function InvitesClient() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [accessMinutes, setAccessMinutes] = useState(60);
  const [linkHours, setLinkHours] = useState(12);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreatedUrl, setJustCreatedUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invites");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to load");
      setCodes(body.codes ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer through a microtask so the effect body doesn't synchronously
    // setState — react-hooks/set-state-in-effect flags the synchronous form.
    queueMicrotask(refresh);
  }, [refresh]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setJustCreatedUrl(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_duration_minutes: accessMinutes,
          link_window_hours: linkHours,
          note: note.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create");
      setJustCreatedUrl(body.url);
      setNote("");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this invite? Existing redemptions keep their access.")) return;
    try {
      const res = await fetch(`/api/admin/invites/${id}/revoke`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to revoke");
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  return (
    <div className="space-y-8">
      {/* Create form */}
      <section className="glass-card rounded-xl p-6">
        <h2 className="text-sm font-medium text-[var(--color-primary)] mb-4">Generate new invite</h2>
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Access duration (minutes)" hint="Default 60 = 1 hour">
              <input
                type="number"
                min={1}
                max={43200}
                value={accessMinutes}
                onChange={(e) => setAccessMinutes(Math.max(1, parseInt(e.target.value) || 60))}
                className="admin-input"
              />
              <div className="flex gap-2 mt-2">
                {[15, 60, 240, 1440, 10080].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAccessMinutes(m)}
                    className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider border border-[var(--color-border-default)] rounded hover:border-violet-400/60 text-[var(--color-tertiary)] hover:text-violet-400 transition-colors"
                  >
                    {m < 60 ? `${m}m` : m < 1440 ? `${m / 60}h` : `${m / 1440}d`}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Link redemption window (hours)" hint="Default 12 — link expires if unredeemed">
              <input
                type="number"
                min={1}
                max={720}
                value={linkHours}
                onChange={(e) => setLinkHours(Math.max(1, parseInt(e.target.value) || 12))}
                className="admin-input"
              />
            </Field>
          </div>
          <Field label="Internal note (who you sent it to)" hint="Optional">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Rebecca @ TIPA breakfast 2026-06-15"
              className="admin-input"
            />
          </Field>
          {error && (
            <div className="text-[12px] text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded px-3 py-2">
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" size="sm" loading={creating}>
            Generate invite link
          </Button>
        </form>

        {justCreatedUrl && (
          <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-4 py-3">
            <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 mb-1">
              New invite created — copy now, this is the only time you&apos;ll see it
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[12px] text-[var(--color-primary)] bg-black/30 px-2 py-1 rounded break-all">
                {justCreatedUrl}
              </code>
              <button
                onClick={() => copy(justCreatedUrl)}
                className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider border border-emerald-400/40 rounded text-emerald-400 hover:bg-emerald-400/10 transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-tertiary)] mt-2 leading-relaxed">
              The plaintext code is not stored in the database. If you lose this URL you&apos;ll need to revoke + regenerate.
            </p>
          </div>
        )}
      </section>

      {/* List */}
      <section className="glass-card rounded-xl p-6">
        <h2 className="text-sm font-medium text-[var(--color-primary)] mb-4">
          All invites {codes.length > 0 && <span className="text-[var(--color-tertiary)]">· {codes.length}</span>}
        </h2>
        {loading ? (
          <p className="text-xs text-[var(--color-tertiary)]">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="text-xs text-[var(--color-tertiary)]">No invites yet. Generate one above.</p>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => (
              <InviteRow key={c.id} code={c} onRevoke={() => revoke(c.id)} />
            ))}
          </div>
        )}
      </section>

      <style>{`
        .admin-input {
          width: 100%;
          background: transparent;
          border: 1px solid var(--color-border-default);
          border-radius: 6px;
          padding: 8px 10px;
          color: var(--color-primary);
          font-size: 13px;
        }
        .admin-input:focus { outline: none; border-color: rgb(139 92 246 / 0.6); }
      `}</style>
    </div>
  );
}

function InviteRow({
  code,
  onRevoke,
}: {
  code: InviteCode;
  onRevoke: () => void;
}) {
  // Render-time Date.now() comparison is intentional — the row reflects
  // the moment of viewing. Re-rendering on data refresh re-evaluates
  // freshness; we don't need to memoize.
  // eslint-disable-next-line react-hooks/purity
  const linkDead = new Date(code.link_expires_at).getTime() < Date.now();
  const depleted = code.used_count >= code.max_uses;
  const revoked = !!code.revoked_at;

  let status: { label: string; color: string };
  if (revoked) status = { label: "Revoked", color: "text-[var(--color-tertiary)]" };
  else if (depleted) status = { label: "Redeemed", color: "text-emerald-400" };
  else if (linkDead) status = { label: "Expired", color: "text-[var(--color-tertiary)]" };
  else status = { label: "Pending", color: "text-violet-400" };

  const accessDesc =
    code.access_duration_minutes < 60
      ? `${code.access_duration_minutes}m`
      : code.access_duration_minutes < 1440
      ? `${code.access_duration_minutes / 60}h`
      : `${(code.access_duration_minutes / 1440).toFixed(1)}d`;

  return (
    <div className="border border-[var(--color-border-default)] rounded-lg p-3 text-[12px]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-mono text-[10px] uppercase tracking-wider ${status.color}`}>
              {status.label}
            </span>
            <span className="text-[var(--color-tertiary)]">·</span>
            <span className="font-mono text-[10px] text-[var(--color-tertiary)]">{accessDesc} grant</span>
            {code.note && (
              <>
                <span className="text-[var(--color-tertiary)]">·</span>
                <span className="text-[var(--color-secondary)] truncate">{code.note}</span>
              </>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-quaternary)] font-mono">
            Granted {new Date(code.granted_at).toLocaleDateString()} · expires{" "}
            {new Date(code.link_expires_at).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!revoked && !depleted && (
            <button
              onClick={onRevoke}
              className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-[var(--color-danger)]/40 rounded text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
            >
              Revoke
            </button>
          )}
        </div>
      </div>
      {code.redemptions.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] text-[10px] text-[var(--color-tertiary)] font-mono">
          Redeemed {new Date(code.redemptions[0]!.redeemed_at).toLocaleString()} · expires{" "}
          {new Date(code.redemptions[0]!.access_expires_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-tertiary)]">
          {label}
        </label>
        {hint && <span className="text-[10px] text-[var(--color-quaternary)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
