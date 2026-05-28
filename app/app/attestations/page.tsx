import Link from "next/link";
import { createAuthedServerClient } from "@/lib/supabase/server-auth";
import { getAppSession, assertActive } from "@/lib/auth/session";
import { isAdmin, type Role } from "@/lib/auth/permissions";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import GenerateButtons from "./GenerateButtons";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  hipaa_sra: "HIPAA Security Risk Assessment",
  soc2_readiness: "SOC 2 Readiness Report",
};

export default async function AttestationsPage() {
  const session = await getAppSession();
  assertActive(session);
  const role = session.membership.role as Role;

  const supabase = await createAuthedServerClient();
  const { data: attestations } = await supabase
    .from("attestations")
    .select("id, type, status, title, generated_at, signed_at, signer_name, signature_method")
    .eq("practice_id", session.membership.practice_id)
    .order("generated_at", { ascending: false });

  return (
    <div className="px-8 py-10 max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Documentation"
        title="Attestations"
        description="Formal compliance deliverables. Generate a point-in-time Security Risk Assessment or SOC 2 readiness report, then sign it in-product or print it for a wet-ink signature."
      />

      {isAdmin(role) && (
        <div className="mb-8">
          <GenerateButtons />
        </div>
      )}

      {(!attestations || attestations.length === 0) ? (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-[var(--color-tertiary)]">
              No attestations yet.{" "}
              {isAdmin(role) ? "Generate one above to get started." : "An admin can generate one."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {attestations.map((a) => (
            <Link key={a.id} href={`/app/attestations/${a.id}`}>
              <Card variant="interactive">
                <CardBody className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--color-primary)] font-medium truncate">
                      {TYPE_LABEL[a.type] ?? a.title}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-quaternary)] mt-1">
                      Generated {new Date(a.generated_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      {a.signed_at && a.signer_name ? ` · Signed by ${a.signer_name}` : ""}
                    </p>
                  </div>
                  <Badge variant={a.status === "signed" ? "success" : a.status === "superseded" ? "muted" : "warning"}>
                    {a.status === "signed" ? "Signed" : a.status === "superseded" ? "Superseded" : "Draft"}
                  </Badge>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
