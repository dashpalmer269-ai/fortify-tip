"use client";

import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";

interface PolicyRow {
  id: string;
  title: string;
  status: string;
  requires_acknowledgement: boolean | null;
  updated_at: string | null;
}

export default function DashboardEmployee({
  practiceName,
  fullName,
  jobTitle,
  userEmail,
  role,
  publishedPolicies,
}: {
  practiceName: string;
  fullName: string | null;
  jobTitle: string | null;
  userEmail: string;
  role: Role;
  publishedPolicies: PolicyRow[];
}) {
  const firstName = fullName?.split(" ")[0] ?? userEmail.split("@")[0];

  return (
    <div className="px-8 py-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-violet-300/80 mb-3">
          {practiceName}
        </p>
        <h1
          className="font-display text-[clamp(32px,4vw,46px)] text-[var(--color-primary)] leading-[1.05] mb-3"
          style={{ letterSpacing: "-0.025em" }}
        >
          Welcome back, {firstName}.
        </h1>
        <p className="text-sm text-[var(--color-tertiary)]">
          {jobTitle ?? ROLE_LABELS[role]} · {ROLE_LABELS[role]}
        </p>
      </div>

      {/* Two-up: identity + role */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        <Card className="lg:col-span-2">
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-4">
              Your access
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <Row label="Name" value={fullName ?? "—"} />
              <Row label="Email" value={userEmail} />
              <Row label="Role at practice" value={jobTitle ?? "—"} />
              <Row label="System role" value={ROLE_LABELS[role]} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-4">
              Things to know
            </p>
            <ul className="space-y-3 text-sm text-[var(--color-secondary)] leading-relaxed">
              <Bullet>You can view published policies and acknowledge those required of you.</Bullet>
              <Bullet>Threat intel relevant to your practice is in the sidebar.</Bullet>
              <Bullet>Reach out to an admin for anything you can&apos;t access.</Bullet>
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* Policies you can acknowledge */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[var(--color-tertiary)] mb-1">
            Recently published
          </p>
          <h2
            className="font-display text-2xl text-[var(--color-primary)]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Policies for you
          </h2>
        </div>
        <Link
          href="/app/policies"
          className="text-[13px] text-[var(--color-tertiary)] hover:text-[var(--color-primary)] transition-colors"
        >
          View all →
        </Link>
      </div>

      {publishedPolicies.length === 0 ? (
        <Card>
          <CardBody className="text-center py-10">
            <p className="text-sm text-[var(--color-tertiary)]">
              No published policies yet. Your admin will let you know when there&apos;s something to read.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {publishedPolicies.map((p) => (
            <Link key={p.id} href={`/app/policies/${p.id}`}>
              <Card variant="interactive">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--color-primary)] font-medium mb-1">{p.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-tertiary)]">
                      {p.requires_acknowledgement ? "Acknowledgement requested" : "Reference"}
                    </p>
                  </div>
                  <span className="text-[var(--color-tertiary)]">→</span>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-quaternary)] mb-1">
        {label}
      </dt>
      <dd className="text-[var(--color-primary)]">{value}</dd>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-400/70 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}
