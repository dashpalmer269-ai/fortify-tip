/**
 * Guided Setup Checklist engine.
 *
 * The connective tissue of Fortify's self-serve flow: after onboarding,
 * this computes — from the practice's REAL data — exactly what the
 * practice still needs to do to become audit-ready, in plain language.
 *
 * Design:
 *   • `buildChecklist(state)` is PURE — given the raw counts, it returns
 *     the ordered, plain-language steps with done/not-done. Unit-tested.
 *   • `loadSetupChecklist(db, practiceId)` fetches the counts (parallel,
 *     RLS-respecting authed client) and calls buildChecklist.
 *
 * Each step maps to something that actually moves the readiness score:
 * team, integrations, policies, vendors/BAAs, risk assessment, exclusion
 * screening, workforce training, and open safeguards. Nothing here is
 * cosmetic — every item is a real input to audit-readiness.
 *
 * Adding a step: add a field to SetupState, a query in loadSetupChecklist,
 * and a STEP_DEFS entry. The pure builder + tests pick it up automatically.
 */

export type SetupStepId =
  | "team"
  | "connect_productivity"
  | "policies"
  | "vendors"
  | "risk_assessment"
  | "exclusion_screening"
  | "training"
  | "safeguards";

export interface SetupState {
  /** practice_users rows (including the founder). > 1 means a team exists. */
  teamCount: number;
  /** connected integrations of type microsoft_365 OR google_workspace. */
  productivityConnected: boolean;
  /** any other connected integration (okta/aws) — informational. */
  otherIntegrationsConnected: number;
  /** active policies. */
  activePolicies: number;
  /** vendors on record. */
  vendorCount: number;
  /** PHI-handling vendors WITHOUT a current (active, unexpired) BAA. */
  phiVendorsMissingBaa: number;
  /** completed risk assessments. */
  riskAssessments: number;
  /** exclusion screenings ever run for this practice. */
  screeningsRun: number;
  /** workforce training completions recorded. */
  trainingCompletions: number;
  /** practice_controls still in 'not_started' — un-reviewed safeguards. */
  notStartedControls: number;
  /** total practice_controls (so we can show "X of Y reviewed"). */
  totalControls: number;
}

export interface SetupStep {
  id: SetupStepId;
  title: string;
  /** Why this matters — one plain sentence. */
  why: string;
  /** Exactly what to do next — plain, imperative. */
  whatToDo: string;
  /** Where the user goes to do it. */
  href: string;
  /** Who normally does this. */
  role: "Admin" | "Anyone";
  done: boolean;
  /** Optional short status detail, e.g. "3 of 12 reviewed". */
  detail?: string;
  /** Whether this step counts toward the required completion total.
   *  Some steps are strongly recommended but optional for a minimal
   *  audit-ready posture. */
  required: boolean;
}

export interface SetupChecklist {
  steps: SetupStep[];
  /** Required steps completed. */
  completedCount: number;
  /** Total required steps. */
  totalCount: number;
  /** 0–100. */
  percentComplete: number;
  /** The next incomplete required step, if any — what to do right now. */
  nextStep: SetupStep | null;
  /** True when every required step is done. */
  allComplete: boolean;
}

export function buildChecklist(s: SetupState): SetupChecklist {
  const steps: SetupStep[] = [
    {
      id: "team",
      title: "Add your team",
      why: "Compliance is a team effort. Adding staff lets Fortify assign training, policy sign-offs, and tasks to the right people.",
      whatToDo:
        "Invite your administrators and staff by email. Most practices start with at least one other admin.",
      href: "/app/team",
      role: "Admin",
      required: true,
      done: s.teamCount > 1,
      detail: s.teamCount > 1 ? `${s.teamCount} members` : "Just you so far",
    },
    {
      id: "connect_productivity",
      title: "Connect Microsoft 365 or Google Workspace",
      why: "This is the biggest time-saver. Fortify automatically checks MFA, inactive accounts, admin access, and sharing settings — collecting evidence for dozens of controls without any manual work.",
      whatToDo:
        "Open Integrations and click Connect on Microsoft 365 or Google Workspace. You'll sign in once and approve read-only access.",
      href: "/app/integrations",
      role: "Admin",
      required: true,
      done: s.productivityConnected,
      detail: s.productivityConnected
        ? "Connected"
        : s.otherIntegrationsConnected > 0
        ? `${s.otherIntegrationsConnected} other connected — add M365/Google for the most coverage`
        : "Not connected",
    },
    {
      id: "policies",
      title: "Add your policies",
      why: "Auditors expect written policies (Privacy, Security, Breach Notification, and more). Fortify can draft them for you, then your staff acknowledge them.",
      whatToDo:
        "Open Policies and generate the recommended healthcare policy set, or upload your existing documents.",
      href: "/app/policies",
      role: "Admin",
      required: true,
      done: s.activePolicies > 0,
      detail: s.activePolicies > 0 ? `${s.activePolicies} active` : "None yet",
    },
    {
      id: "vendors",
      title: "Review vendors & BAAs",
      why: "Any vendor that touches patient data needs a signed Business Associate Agreement. Missing or expired BAAs are a common audit finding.",
      whatToDo:
        s.phiVendorsMissingBaa > 0
          ? "Open Vendors and add a signed BAA for each vendor that handles patient data."
          : "Open Vendors and list the companies that handle your patient data or systems.",
      href: "/app/vendors",
      role: "Admin",
      required: true,
      done: s.vendorCount > 0 && s.phiVendorsMissingBaa === 0,
      detail:
        s.vendorCount === 0
          ? "No vendors added"
          : s.phiVendorsMissingBaa > 0
          ? `${s.phiVendorsMissingBaa} need a BAA`
          : `${s.vendorCount} reviewed`,
    },
    {
      id: "risk_assessment",
      title: "Complete a risk assessment",
      why: "A HIPAA Security Risk Assessment is legally required and is the #1 thing auditors ask for. Fortify guides you through it and writes the summary.",
      whatToDo: "Open Risk Assessment and answer the guided questionnaire. It takes about 15 minutes.",
      href: "/app/risk-assessment",
      role: "Admin",
      required: true,
      done: s.riskAssessments > 0,
      detail: s.riskAssessments > 0 ? "Completed" : "Not started",
    },
    {
      id: "exclusion_screening",
      title: "Screen your workforce",
      why: "Federal law requires checking staff and vendors against the OIG exclusion list. Hiring or paying an excluded person can mean serious penalties.",
      whatToDo: "Run exclusion screening for your team from the Team page. Fortify re-checks monthly automatically.",
      href: "/app/team",
      role: "Admin",
      required: true,
      done: s.screeningsRun > 0,
      detail: s.screeningsRun > 0 ? `${s.screeningsRun} screened` : "Not started",
    },
    {
      id: "training",
      title: "Assign workforce training",
      why: "Annual HIPAA training is required for everyone. Fortify tracks who's completed it and when it expires.",
      whatToDo: "Open Training and have each team member complete the HIPAA modules.",
      href: "/app/training",
      role: "Anyone",
      required: true,
      done: s.trainingCompletions > 0,
      detail: s.trainingCompletions > 0 ? `${s.trainingCompletions} completed` : "None completed",
    },
    {
      id: "safeguards",
      title: "Review your safeguards",
      why: "These are the specific security controls (across HIPAA, SOC 2, ISO 27001, GDPR) that make up your readiness score. Connecting integrations clears most of them automatically.",
      whatToDo:
        "Open Compliance to see which safeguards still need attention. Anything Fortify can't verify automatically will have a clear task.",
      href: "/app/compliance",
      role: "Admin",
      required: true,
      done: s.totalControls > 0 && s.notStartedControls === 0,
      detail:
        s.totalControls === 0
          ? "Loading…"
          : `${s.totalControls - s.notStartedControls} of ${s.totalControls} reviewed`,
    },
  ];

  const required = steps.filter((st) => st.required);
  const completedCount = required.filter((st) => st.done).length;
  const totalCount = required.length;
  const percentComplete = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const nextStep = required.find((st) => !st.done) ?? null;

  return {
    steps,
    completedCount,
    totalCount,
    percentComplete,
    nextStep,
    allComplete: completedCount === totalCount,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Fetch the practice's real state and compute the checklist. Uses the
 * caller's authed client so every query is RLS-scoped to their practice.
 * All counts run in parallel.
 */
export async function loadSetupChecklist(
  db: SupabaseClient<Database>,
  practiceId: string
): Promise<SetupChecklist> {
  const countOf = async (
    table: string,
    apply: (q: ReturnType<SupabaseClient<Database>["from"]>) => unknown
  ): Promise<number> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = (db.from(table as any).select("id", { count: "exact", head: true }) as any).eq(
      "practice_id",
      practiceId
    );
    const res = await apply(q);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (res as any).count ?? 0;
  };

  const [
    teamCount,
    productivityConnected,
    otherIntegrationsConnected,
    activePolicies,
    vendorCount,
    phiVendorsMissingBaa,
    riskAssessments,
    screeningsRun,
    trainingCompletions,
    notStartedControls,
    totalControls,
  ] = await Promise.all([
    // team
    db
      .from("practice_users")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .then((r) => r.count ?? 0),
    // M365 or Google connected
    db
      .from("integrations")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .eq("status", "connected")
      .in("integration_type", ["microsoft_365", "google_workspace"])
      .then((r) => (r.count ?? 0) > 0),
    // other connected (okta/aws)
    db
      .from("integrations")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .eq("status", "connected")
      .in("integration_type", ["okta", "aws"])
      .then((r) => r.count ?? 0),
    // active policies
    db
      .from("policies")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .eq("status", "active")
      .then((r) => r.count ?? 0),
    // vendors
    db
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .then((r) => r.count ?? 0),
    // PHI vendors missing a current BAA — computed below from two reads
    computePhiVendorsMissingBaa(db, practiceId),
    // risk assessments
    db
      .from("risk_assessments")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .then((r) => r.count ?? 0),
    // exclusion screenings
    db
      .from("exclusion_screenings")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .then((r) => r.count ?? 0),
    // training completions
    db
      .from("training_completions")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .then((r) => r.count ?? 0),
    // not-started controls
    db
      .from("practice_controls")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .eq("status", "not_started")
      .then((r) => r.count ?? 0),
    // total controls
    db
      .from("practice_controls")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practiceId)
      .then((r) => r.count ?? 0),
  ]);

  void countOf; // reserved helper for future steps

  return buildChecklist({
    teamCount,
    productivityConnected,
    otherIntegrationsConnected,
    activePolicies,
    vendorCount,
    phiVendorsMissingBaa,
    riskAssessments,
    screeningsRun,
    trainingCompletions,
    notStartedControls,
    totalControls,
  });
}

/**
 * Count PHI-handling vendors that lack a current (active, unexpired) BAA.
 * Two reads: PHI vendors, and their active BAAs.
 */
async function computePhiVendorsMissingBaa(
  db: SupabaseClient<Database>,
  practiceId: string
): Promise<number> {
  const { data: phiVendors } = await db
    .from("vendors")
    .select("id")
    .eq("practice_id", practiceId)
    .eq("phi_access", true);
  if (!phiVendors || phiVendors.length === 0) return 0;

  const nowIso = new Date().toISOString();
  const { data: activeBaas } = await db
    .from("baas")
    .select("vendor_id, expiration_date, status")
    .eq("practice_id", practiceId)
    .eq("status", "active");

  const coveredVendorIds = new Set(
    (activeBaas ?? [])
      .filter((b) => !b.expiration_date || b.expiration_date > nowIso)
      .map((b) => b.vendor_id)
  );
  return phiVendors.filter((v) => !coveredVendorIds.has(v.id)).length;
}
