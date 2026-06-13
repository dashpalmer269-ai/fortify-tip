"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdmin, isOfficer, type Role, ROLE_LABELS } from "@/lib/auth/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: (p: { active: boolean }) => React.ReactNode;
  minRole?: "officer" | "admin";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/app",                 label: "Dashboard",      icon: DashboardIcon },
  { href: "/app/setup",           label: "Setup checklist", icon: ComplianceIcon, minRole: "admin" },
  { href: "/app/compliance",      label: "Compliance",     icon: ComplianceIcon },
  { href: "/app/coverage",        label: "Coverage",       icon: ComplianceIcon, minRole: "officer" },
  { href: "/app/risk-assessment", label: "Risk",           icon: RiskIcon,     minRole: "officer" },
  { href: "/app/policies",        label: "Policies",       icon: PolicyIcon },
  { href: "/app/training",        label: "Training",       icon: PolicyIcon },
  { href: "/app/vendors",         label: "Vendors",        icon: VendorIcon },
  { href: "/app/threats",         label: "Threat intel",   icon: ThreatIcon },
  { href: "/app/reports",         label: "Reports",        icon: ReportIcon,   minRole: "officer" },
  { href: "/app/attestations",    label: "Attestations",   icon: AttestationIcon, minRole: "officer" },
  { href: "/app/audit-log",       label: "Audit log",      icon: AuditIcon },
  { href: "/app/team",            label: "Edit Staff",     icon: StaffIcon,    minRole: "admin" },
];

const SETTINGS_ITEMS: NavItem[] = [
  { href: "/app/integrations", label: "Integrations", icon: DashboardIcon, minRole: "admin" },
  { href: "/app/team",         label: "Team",         icon: DashboardIcon },
  { href: "/app/billing",      label: "Billing",      icon: DashboardIcon, minRole: "admin" },
  { href: "/app/settings",     label: "Settings",     icon: DashboardIcon },
  { href: "/app/help",         label: "Help",         icon: DashboardIcon },
];

function canSeeItem(item: NavItem, role: Role | null | undefined): boolean {
  if (!item.minRole) return true;
  if (item.minRole === "officer") return isOfficer(role);
  if (item.minRole === "admin") return isAdmin(role);
  return true;
}

export default function Sidebar({
  practiceName,
  role,
}: {
  practiceName: string;
  role?: Role | null;
}) {
  const pathname = usePathname();
  const visibleNav = NAV_ITEMS.filter((i) => canSeeItem(i, role));
  const visibleSettings = SETTINGS_ITEMS.filter((i) => canSeeItem(i, role));

  return (
    <aside className="w-60 shrink-0 border-r border-[var(--color-border-subtle)] flex flex-col bg-[var(--color-canvas)]">
      {/* Brand mark — home button to the marketing site */}
      <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border-subtle)]">
        <Link
          href="/"
          aria-label="Fortify — home"
          className="font-mono text-[12px] font-bold tracking-[0.45em] text-[var(--color-primary)] uppercase hover:text-violet-300 transition-colors block mb-4"
        >
          Fortify
        </Link>
        <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-[var(--color-quaternary)] mb-1.5">
          Practice
        </p>
        <Link
          href="/app"
          className="font-display text-base text-[var(--color-primary)] block leading-tight truncate hover:text-violet-300 transition-colors"
          style={{ letterSpacing: "-0.01em" }}
          title={practiceName}
        >
          {practiceName}
        </Link>
        {role && (
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.3em] text-violet-300/70">
            {ROLE_LABELS[role]}
          </p>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-px">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors ${
                isActive
                  ? "text-[var(--color-primary)] bg-[var(--color-surface-raised)]"
                  : "text-[var(--color-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)]"
              }`}
            >
              <Icon active={isActive} />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1 h-1 rounded-full bg-[var(--color-accent)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-[var(--color-border-subtle)] space-y-px">
        <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-[var(--color-quaternary)] px-3 py-2">
          Workspace
        </p>
        {visibleSettings.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-1.5 rounded-md text-[12px] transition-colors ${
                isActive
                  ? "text-[var(--color-primary)] bg-[var(--color-surface)]"
                  : "text-[var(--color-tertiary)] hover:text-[var(--color-primary)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

/* Icons — uniform 1.5px stroke */
const stroke = "1.5";
function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke}>
      <rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
function ComplianceIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke}>
      <path d="M9 12l2 2 4-4" /><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function RiskIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function PolicyIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z" />
      <path d="M5 6h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1z" />
      <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}
function VendorIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
function ThreatIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke}>
      <circle cx="12" cy="12" r="3" /><path d="M3 12a9 9 0 0 0 9 9 9 9 0 0 0 9-9 9 9 0 0 0-9-9 9 9 0 0 0-9 9z" />
    </svg>
  );
}
function ReportIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" /><line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}
function AttestationIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m9 15 2 2 4-4" />
    </svg>
  );
}
function StaffIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function AuditIcon({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--color-accent)" : "currentColor"} strokeWidth={stroke}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}
