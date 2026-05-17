"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import type { VendorWithBaa } from "./page";

const VENDOR_TYPES = [
  { value: "emr", label: "EMR / EHR" },
  { value: "billing", label: "Billing / RCM" },
  { value: "lab", label: "Lab / Diagnostics" },
  { value: "cloud", label: "Cloud / Hosting" },
  { value: "msp", label: "MSP / IT services" },
  { value: "other", label: "Other" },
];

const STATUS_META: Record<VendorWithBaa["baa_status"], { label: string; color: string; bg: string }> = {
  active:     { label: "Active",      color: "#10b981", bg: "rgba(16,185,129,0.15)" },
  pending:    { label: "Pending",     color: "#eab308", bg: "rgba(234,179,8,0.15)" },
  expired:    { label: "Expired",     color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  terminated: { label: "Terminated",  color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
  missing:    { label: "No BAA",      color: "#ef4444", bg: "rgba(239,68,68,0.18)" },
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
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-violet-400 mb-1">Vendor risk</p>
          <h1 className="text-3xl font-bold text-white">Vendors &amp; BAAs</h1>
          <p className="text-sm text-gray-500 mt-2">
            Every vendor with PHI access needs a signed Business Associate Agreement on file. HIPAA §164.308(b)(1).
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="bg-violet-500 hover:bg-violet-400 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
          style={{ boxShadow: "0 0 20px rgba(139,92,246,0.4)" }}
        >
          {showAdd ? "Close" : "+ Add vendor"}
        </button>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="PHI-access vendors" value={phiCount} color="#a78bfa" />
        <StatCard
          label="Missing or expired BAAs"
          value={phiMissingBaa}
          color={phiMissingBaa > 0 ? "#ef4444" : "#10b981"}
        />
        <StatCard
          label="Expiring in 90 days"
          value={expiringSoon}
          color={expiringSoon > 0 ? "#f97316" : "#10b981"}
        />
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
        <div className="glass-card rounded-2xl p-12 text-center text-gray-500">
          No vendors yet. Add your first one — EMR, billing service, cloud host, lab — to start tracking BAA status.
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] border-b border-white/[0.05] text-left text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">PHI</th>
                <th className="px-4 py-3 font-medium">BAA</th>
                <th className="px-4 py-3 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {vendors.map((v) => {
                const sm = STATUS_META[v.baa_status];
                const expWarn =
                  v.baa_status === "active" &&
                  v.days_until_expiration !== null &&
                  v.days_until_expiration <= 30;
                return (
                  <tr key={v.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium">{v.vendor_name}</p>
                      {v.contact_email && (
                        <p className="text-xs text-gray-500">{v.contact_email}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 capitalize">{v.vendor_type ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {v.phi_access ? (
                        <span className="text-violet-300 font-medium">PHI access</span>
                      ) : (
                        <span className="text-gray-600">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ color: sm.color, background: sm.bg }}
                      >
                        {sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {v.baa_expiration_date ? (
                        <span className={expWarn ? "text-red-400" : "text-gray-400"}>
                          {new Date(v.baa_expiration_date).toLocaleDateString("en-US", {
                            dateStyle: "medium",
                          })}
                          {v.days_until_expiration !== null && (
                            <span className="text-gray-600 ml-1">
                              ({v.days_until_expiration > 0
                                ? `${v.days_until_expiration}d`
                                : `${-v.days_until_expiration}d ago`})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="glass-card rounded-xl p-5"
      style={{ boxShadow: `0 0 18px ${color}20` }}
    >
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">{label}</p>
      <p className="text-3xl font-black tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function AddVendorForm({
  practiceId,
  onSaved,
}: {
  practiceId: string;
  onSaved: () => void;
}) {
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
      // Insert the vendor
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
      if (vErr || !vendor) {
        setError(vErr?.message ?? "Failed to add vendor.");
        return;
      }
      // Optionally insert the BAA record
      if (baaStatus !== "pending" || signedDate) {
        const { error: bErr } = await supabase.from("baas").insert({
          practice_id: practiceId,
          vendor_id: vendor.id,
          status: baaStatus,
          signed_date: signedDate || null,
          expiration_date: expirationDate || null,
        });
        if (bErr) {
          setError(`Vendor added, but BAA failed: ${bErr.message}`);
          return;
        }
      }
      // Audit log
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
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 mb-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Add vendor</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Vendor name *">
          <input
            type="text"
            required
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="e.g. athenahealth"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
          />
        </Field>
        <Field label="Type">
          <select
            value={vendorType}
            onChange={(e) => setVendorType(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
          >
            {VENDOR_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-black">
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="security@vendor.com"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
          />
        </Field>
        <Field label="PHI access?">
          <label className="flex items-center gap-2 text-sm text-gray-300 mt-1.5">
            <input
              type="checkbox"
              checked={phiAccess}
              onChange={(e) => setPhiAccess(e.target.checked)}
              className="accent-violet-500"
            />
            This vendor accesses, stores, or transmits ePHI
          </label>
        </Field>
      </div>

      <div className="border-t border-white/[0.06] pt-4">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">BAA (optional now)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Status">
            <select
              value={baaStatus}
              onChange={(e) => setBaaStatus(e.target.value as "active" | "pending")}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
            >
              <option value="pending" className="bg-black">Pending</option>
              <option value="active" className="bg-black">Active</option>
            </select>
          </Field>
          <Field label="Signed date">
            <input
              type="date"
              value={signedDate}
              onChange={(e) => setSignedDate(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
            />
          </Field>
          <Field label="Expiration">
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
            />
          </Field>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving || !vendorName.trim()}
        className="bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
      >
        {saving ? "Saving…" : "Save vendor"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-gray-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
