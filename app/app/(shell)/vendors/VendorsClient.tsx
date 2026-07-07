"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import type { VendorWithBaa } from "./page";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

const VENDOR_TYPES = [
  { value: "emr",    label: "EMR / EHR" },
  { value: "billing", label: "Billing / RCM" },
  { value: "lab",    label: "Lab / Diagnostics" },
  { value: "cloud",  label: "Cloud / Hosting" },
  { value: "msp",    label: "MSP / IT services" },
  { value: "other",  label: "Other" },
];

const STATUS_VARIANT: Record<VendorWithBaa["baa_status"], "success" | "warning" | "danger" | "muted"> = {
  active: "success",
  pending: "warning",
  expired: "danger",
  terminated: "muted",
  missing: "danger",
};

const STATUS_LABEL: Record<VendorWithBaa["baa_status"], string> = {
  active: "Active",
  pending: "Pending",
  expired: "Expired",
  terminated: "Terminated",
  missing: "No BAA",
};

export default function VendorsClient({
  practiceId,
  vendors,
}: {
  practiceId: string;
  vendors: VendorWithBaa[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);

  const phiCount = vendors.filter((v) => v.phi_access).length;
  const phiMissingBaa = vendors.filter(
    (v) => v.phi_access && (v.baa_status === "missing" || v.baa_status === "expired" || v.baa_status === "terminated")
  ).length;
  const expiringSoon = vendors.filter(
    (v) =>
      v.baa_status === "active" &&
      v.days_until_expiration !== null &&
      v.days_until_expiration <= 90 &&
      v.days_until_expiration >= 0
  ).length;

  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Vendor risk"
        title="Vendors &amp; BAAs"
        description="Every vendor with PHI access needs a signed Business Associate Agreement on file. HIPAA §164.308(b)(1)."
        action={<Button onClick={() => setShowAdd((s) => !s)} variant="primary">{showAdd ? "Close" : "Add vendor"}</Button>}
      />

      {/* Stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px mb-6 surface rounded-xl overflow-hidden">
        <Stat label="PHI-access vendors" value={phiCount} tone="var(--color-primary)" />
        <Stat label="Missing or expired BAAs" value={phiMissingBaa} tone={phiMissingBaa > 0 ? "var(--color-danger)" : "var(--color-success)"} />
        <Stat label="Expiring in 90 days" value={expiringSoon} tone={expiringSoon > 0 ? "var(--color-warning)" : "var(--color-success)"} />
      </div>

      {showAdd && (
        <AddVendorForm
          practiceId={practiceId}
          onSaved={() => {
            setShowAdd(false);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="Add your first one — EMR, billing service, cloud host, lab — to start tracking BAA status."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid items-center gap-4 px-5 py-3 border-b border-[var(--color-border-subtle)] font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-quaternary)]"
               style={{ gridTemplateColumns: "2fr 110px 100px 100px 160px" }}>
            <div>Vendor</div>
            <div>Type</div>
            <div>PHI</div>
            <div>BAA</div>
            <div>Expires</div>
          </div>
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {vendors.map((v) => {
              const expWarn = v.baa_status === "active" && v.days_until_expiration !== null && v.days_until_expiration <= 30;
              return (
                <div
                  key={v.id}
                  className="grid items-center gap-4 px-5 py-3 hover:bg-[var(--color-surface-raised)] transition-colors"
                  style={{ gridTemplateColumns: "2fr 110px 100px 100px 160px" }}
                >
                  <div className="min-w-0">
                    <p className="text-[var(--color-primary)] text-sm font-medium truncate">{v.vendor_name}</p>
                    {v.contact_email && (
                      <p className="text-xs text-[var(--color-tertiary)] font-mono truncate">{v.contact_email}</p>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-tertiary)] capitalize">{v.vendor_type ?? "—"}</span>
                  <span>
                    {v.phi_access ? (
                      <Badge variant="accent">PHI</Badge>
                    ) : (
                      <span className="text-xs text-[var(--color-quaternary)]">none</span>
                    )}
                  </span>
                  <Badge variant={STATUS_VARIANT[v.baa_status]}>{STATUS_LABEL[v.baa_status]}</Badge>
                  <span className="text-xs font-mono">
                    {v.baa_expiration_date ? (
                      <span className={expWarn ? "text-[var(--color-danger)]" : "text-[var(--color-tertiary)]"}>
                        {new Date(v.baa_expiration_date).toLocaleDateString("en-US", { dateStyle: "medium" })}
                        {v.days_until_expiration !== null && (
                          <span className="text-[var(--color-quaternary)] ml-1">
                            ({v.days_until_expiration > 0 ? `${v.days_until_expiration}d` : `${-v.days_until_expiration}d ago`})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--color-quaternary)]">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-[var(--color-canvas)] px-5 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-1">{label}</p>
      <p className="font-display text-3xl tabular-nums" style={{ color: tone, letterSpacing: "-0.02em" }}>
        {value}
      </p>
    </div>
  );
}

function AddVendorForm({ practiceId, onSaved }: { practiceId: string; onSaved: () => void }) {
  const [vendorName, setVendorName] = useState("");
  const [vendorType, setVendorType] = useState("cloud");
  const [phiAccess, setPhiAccess] = useState(true);
  const [contactEmail, setContactEmail] = useState("");
  const [baaStatus, setBaaStatus] = useState<"active" | "pending">("pending");
  const [signedDate, setSignedDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const supabase = createBrowserClient();
      const { data: vendor, error: vErr } = await supabase
        .from("vendors")
        .insert({
          practice_id: practiceId,
          vendor_name: vendorName.trim(),
          vendor_type: vendorType,
          phi_access: phiAccess,
          contact_email: contactEmail.trim() || null,
        })
        .select()
        .single();
      if (vErr || !vendor) { setError(vErr?.message ?? "Failed to add vendor."); return; }
      if (baaStatus !== "pending" || signedDate) {
        const { error: bErr } = await supabase.from("baas").insert({
          practice_id: practiceId,
          vendor_id: vendor.id,
          status: baaStatus,
          signed_date: signedDate || null,
          expiration_date: expirationDate || null,
        });
        if (bErr) { setError(`Vendor added, but BAA failed: ${bErr.message}`); return; }
      }
      await supabase.from("audit_logs").insert({
        practice_id: practiceId,
        action: "vendor.added",
        resource_type: "vendor",
        resource_id: vendor.id,
        metadata: { vendor_name: vendorName, phi_access: phiAccess },
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="raised" className="mb-6">
      <CardBody>
        <h3 className="font-display text-lg text-[var(--color-primary)] mb-4" style={{ letterSpacing: "-0.015em" }}>
          Add vendor
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Vendor name *">
              <input required value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. athenahealth" className="form-input" />
            </Field>
            <Field label="Type">
              <select value={vendorType} onChange={(e) => setVendorType(e.target.value)} className="form-input">
                {VENDOR_TYPES.map((t) => <option key={t.value} value={t.value} className="bg-black">{t.label}</option>)}
              </select>
            </Field>
            <Field label="Contact email">
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="security@vendor.com" className="form-input" />
            </Field>
            <Field label="PHI access?">
              <label className="flex items-center gap-2 text-sm text-[var(--color-secondary)] h-9">
                <input type="checkbox" checked={phiAccess} onChange={(e) => setPhiAccess(e.target.checked)} className="accent-[var(--color-accent)]" />
                Accesses, stores, or transmits ePHI
              </label>
            </Field>
          </div>

          <div className="border-t border-[var(--color-border-subtle)] pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)] mb-3">BAA (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Status">
                <select value={baaStatus} onChange={(e) => setBaaStatus(e.target.value as "active" | "pending")} className="form-input">
                  <option value="pending" className="bg-black">Pending</option>
                  <option value="active" className="bg-black">Active</option>
                </select>
              </Field>
              <Field label="Signed date">
                <input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)} className="form-input" />
              </Field>
              <Field label="Expiration">
                <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="form-input" />
              </Field>
            </div>
          </div>

          {error && (
            <div className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-md px-3 py-2">{error}</div>
          )}

          <Button type="submit" loading={saving} disabled={!vendorName.trim()} variant="primary" size="md">
            Save vendor
          </Button>
        </form>

        <style>{`
          .form-input {
            width: 100%; height: 36px; background: transparent;
            border: 1px solid var(--color-border-default); border-radius: 6px;
            padding: 0 10px; color: var(--color-primary); font-size: 13px;
            transition: border-color 150ms ease;
          }
          .form-input:focus { border-color: var(--color-accent); outline: none; }
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
