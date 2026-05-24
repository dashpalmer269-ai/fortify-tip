import { redirect } from "next/navigation";
import { getCurrentUserAndPractice } from "@/lib/supabase/server-auth";
import PageHeader from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import DangerZone from "./DangerZone";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getCurrentUserAndPractice();
  if (!session) redirect("/login");
  if (!session.membership) redirect("/app/onboarding/new-practice");

  const practice = session.membership.practices as unknown as {
    id: string;
    name: string;
    frameworks_enabled: string[];
    hipaa_covered_entity: boolean;
  } | null;
  const role = session.membership.role as Role;

  return (
    <div className="px-8 py-10 max-w-3xl mx-auto">
      <PageHeader eyebrow="Account" title="Settings" />

      <section className="space-y-px">
        <Card>
          <CardBody>
            <h2
              className="font-display text-lg text-[var(--color-primary)] mb-5"
              style={{ letterSpacing: "-0.015em" }}
            >
              Profile
            </h2>
            <dl className="divide-y divide-[var(--color-border-subtle)]">
              <Row label="Email" value={session.user.email ?? "—"} />
              <Row
                label="Role in this practice"
                custom={<Badge variant="accent">{ROLE_LABELS[role]}</Badge>}
              />
              <Row
                label="Account created"
                value={new Date(session.user.created_at).toLocaleDateString("en-US", {
                  dateStyle: "long",
                })}
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2
              className="font-display text-lg text-[var(--color-primary)] mb-5"
              style={{ letterSpacing: "-0.015em" }}
            >
              Practice
            </h2>
            <dl className="divide-y divide-[var(--color-border-subtle)]">
              <Row label="Name" value={practice?.name ?? "—"} />
              <Row
                label="Frameworks"
                custom={
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {practice?.frameworks_enabled.map((f) => (
                      <Badge key={f} variant="accent">
                        {f}
                      </Badge>
                    ))}
                  </div>
                }
              />
              <Row
                label="HIPAA covered entity"
                value={practice?.hipaa_covered_entity ? "Yes" : "No"}
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2
              className="font-display text-lg text-[var(--color-primary)] mb-3"
              style={{ letterSpacing: "-0.015em" }}
            >
              Sign out
            </h2>
            <p className="text-sm text-[var(--color-tertiary)] mb-5 leading-relaxed">
              End your session on this device.
            </p>
            <form action="/auth/signout" method="post">
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </CardBody>
        </Card>
      </section>

      <DangerZone
        practiceId={practice?.id ?? ""}
        practiceName={practice?.name ?? ""}
        role={role}
      />
    </div>
  );
}

function Row({
  label,
  value,
  custom,
}: {
  label: string;
  value?: string;
  custom?: React.ReactNode;
}) {
  return (
    <div className="py-3 flex items-center justify-between gap-4 first:pt-0 last:pb-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)]">
        {label}
      </dt>
      <dd className="text-sm text-[var(--color-primary)]">{custom ?? value}</dd>
    </div>
  );
}
