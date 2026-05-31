import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import VendorsClient from "./VendorsClient";

export const dynamic = "force-dynamic";

export interface VendorWithBaa {
  id: string;
  vendor_name: string;
  vendor_type: string | null;
  phi_access: boolean | null;
  contact_email: string | null;
  contact_name: string | null;
  baa_status: "active" | "pending" | "expired" | "terminated" | "missing";
  baa_signed_date: string | null;
  baa_expiration_date: string | null;
  baa_document_url: string | null;
  days_until_expiration: number | null;
}

export default async function VendorsPage() {
  const session = await getAppSession();
  assertActive(session);

  const supabase = await createAuthedServerClient();

  // Vendors + the latest BAA per vendor (one query each, joined in JS for clarity)
  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, vendor_name, vendor_type, phi_access, contact_email, contact_name, created_at")
    .eq("practice_id", session.membership.practice_id)
    .order("created_at", { ascending: false });

  interface BaaRow {
    vendor_id: string;
    status: VendorWithBaa["baa_status"];
    signed_date: string | null;
    expiration_date: string | null;
    document_url: string | null;
    created_at: string;
  }

  const vendorIds = (vendors ?? []).map((v) => v.id);
  let baas: BaaRow[] = [];
  if (vendorIds.length > 0) {
    const { data } = await supabase
      .from("baas")
      .select("vendor_id, status, signed_date, expiration_date, document_url, created_at")
      .eq("practice_id", session.membership.practice_id)
      .in("vendor_id", vendorIds)
      .order("created_at", { ascending: false });
    baas = (data ?? []) as BaaRow[];
  }

  const latestBaaByVendor = new Map<string, BaaRow>();
  for (const b of baas) {
    if (!latestBaaByVendor.has(b.vendor_id)) latestBaaByVendor.set(b.vendor_id, b);
  }

  // eslint-disable-next-line react-hooks/purity -- server component renders once per request; Date.now is acceptable
  const now = Date.now();
  const enriched: VendorWithBaa[] = (vendors ?? []).map((v) => {
    const b = latestBaaByVendor.get(v.id);
    const exp = b?.expiration_date ?? null;
    const status: VendorWithBaa["baa_status"] = b?.status ?? "missing";
    const daysUntil = exp
      ? Math.floor((new Date(exp).getTime() - now) / (1000 * 60 * 60 * 24))
      : null;
    return {
      id: v.id,
      vendor_name: v.vendor_name,
      vendor_type: v.vendor_type,
      phi_access: v.phi_access,
      contact_email: v.contact_email,
      contact_name: v.contact_name,
      baa_status: status,
      baa_signed_date: b?.signed_date ?? null,
      baa_expiration_date: exp,
      baa_document_url: b?.document_url ?? null,
      days_until_expiration: daysUntil,
    };
  });

  return (
    <VendorsClient
      practiceId={session.membership.practice_id}
      vendors={enriched}
    />
  );
}
