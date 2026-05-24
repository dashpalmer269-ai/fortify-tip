"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isOwner, type Role } from "@/lib/auth/permissions";

export default function DangerZone({
  practiceId,
  practiceName,
  role,
}: {
  practiceId: string;
  practiceName: string;
  role: Role;
}) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const owner = isOwner(role);

  async function leavePractice() {
    if (!confirm(`Leave ${practiceName}? You'll lose access to all of its data immediately.`)) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      const res = await fetch("/api/team/leave", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practice_id: practiceId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setLeaveError(body.error ?? "Failed to leave");
        return;
      }
      router.push("/app/onboarding/new-practice");
      router.refresh();
    } finally {
      setLeaving(false);
    }
  }

  async function deletePractice() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/practice/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ practice_id: practiceId, confirm_name: confirmName }),
      });
      const body = await res.json();
      if (!res.ok) {
        setDeleteError(body.error ?? "Failed to delete");
        return;
      }
      router.push("/app/onboarding/new-practice");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-danger)] mb-3">
        Danger zone
      </p>

      <div className="space-y-px">
        {/* Leave practice — shown to non-owners */}
        {!owner && (
          <Card variant="raised">
            <CardBody>
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="max-w-md">
                  <h3 className="text-[var(--color-primary)] font-medium text-sm mb-1">
                    Leave this practice
                  </h3>
                  <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">
                    Removes you from <span className="text-[var(--color-secondary)]">{practiceName}</span>. You&apos;ll keep your Fortify account and can join another practice or create one.
                  </p>
                </div>
                <Button
                  onClick={leavePractice}
                  loading={leaving}
                  variant="danger"
                  size="sm"
                >
                  Leave practice
                </Button>
              </div>
              {leaveError && (
                <p className="text-xs text-[var(--color-danger)] mt-3">{leaveError}</p>
              )}
            </CardBody>
          </Card>
        )}

        {/* Delete practice — owner only */}
        {owner && (
          <Card variant="raised">
            <CardBody>
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="max-w-md">
                  <h3 className="text-[var(--color-primary)] font-medium text-sm mb-1">
                    Delete this practice
                  </h3>
                  <p className="text-xs text-[var(--color-tertiary)] leading-relaxed">
                    Permanently removes <span className="text-[var(--color-secondary)]">{practiceName}</span> and every record attached to it: controls, evidence, vendors, BAAs, policies, reports, audit log. This cannot be undone.
                  </p>
                </div>
                {!deleteOpen ? (
                  <Button onClick={() => setDeleteOpen(true)} variant="danger" size="sm">
                    Delete practice…
                  </Button>
                ) : (
                  <button
                    onClick={() => {
                      setDeleteOpen(false);
                      setConfirmName("");
                      setDeleteError(null);
                    }}
                    className="text-xs text-[var(--color-tertiary)] hover:text-[var(--color-primary)]"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {deleteOpen && (
                <div className="mt-5 pt-5 border-t border-[var(--color-border-subtle)]">
                  <p className="text-xs text-[var(--color-tertiary)] mb-2">
                    Type <span className="font-mono text-[var(--color-danger)]">{practiceName}</span> to confirm:
                  </p>
                  <input
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={practiceName}
                    className="danger-input"
                    autoFocus
                  />
                  <div className="flex items-center gap-3 mt-4">
                    <Button
                      onClick={deletePractice}
                      loading={deleting}
                      disabled={confirmName.trim().toLowerCase() !== practiceName.trim().toLowerCase()}
                      variant="danger"
                      size="sm"
                    >
                      Permanently delete
                    </Button>
                  </div>
                  {deleteError && (
                    <p className="text-xs text-[var(--color-danger)] mt-3">{deleteError}</p>
                  )}
                </div>
              )}

              <style>{`
                .danger-input {
                  width: 100%; max-width: 380px; height: 36px;
                  background: transparent;
                  border: 1px solid var(--color-danger);
                  border-radius: 6px;
                  padding: 0 10px;
                  color: var(--color-primary);
                  font-size: 13px;
                  font-family: var(--font-mono);
                }
                .danger-input:focus { outline: none; box-shadow: 0 0 0 2px rgba(239,68,68,0.3); }
              `}</style>
            </CardBody>
          </Card>
        )}
      </div>
    </section>
  );
}
