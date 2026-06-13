import { describe, expect, it } from "vitest";
import { buildChecklist, type SetupState } from "@/lib/setup/checklist";

const EMPTY: SetupState = {
  teamCount: 1, // just the founder
  productivityConnected: false,
  otherIntegrationsConnected: 0,
  activePolicies: 0,
  vendorCount: 0,
  phiVendorsMissingBaa: 0,
  riskAssessments: 0,
  screeningsRun: 0,
  trainingCompletions: 0,
  notStartedControls: 12,
  totalControls: 12,
};

const COMPLETE: SetupState = {
  teamCount: 4,
  productivityConnected: true,
  otherIntegrationsConnected: 1,
  activePolicies: 6,
  vendorCount: 3,
  phiVendorsMissingBaa: 0,
  riskAssessments: 1,
  screeningsRun: 4,
  trainingCompletions: 4,
  notStartedControls: 0,
  totalControls: 12,
};

describe("buildChecklist", () => {
  it("brand-new practice has 0% and team as the first next step", () => {
    const c = buildChecklist(EMPTY);
    expect(c.percentComplete).toBe(0);
    expect(c.completedCount).toBe(0);
    expect(c.allComplete).toBe(false);
    expect(c.nextStep?.id).toBe("team");
  });

  it("fully set up practice is 100% and allComplete with no next step", () => {
    const c = buildChecklist(COMPLETE);
    expect(c.percentComplete).toBe(100);
    expect(c.allComplete).toBe(true);
    expect(c.nextStep).toBeNull();
  });

  it("counts each required step exactly once", () => {
    const c = buildChecklist(EMPTY);
    expect(c.totalCount).toBe(c.steps.filter((s) => s.required).length);
  });

  it("team step flips done when a second member exists", () => {
    const c = buildChecklist({ ...EMPTY, teamCount: 2 });
    expect(c.steps.find((s) => s.id === "team")?.done).toBe(true);
    expect(c.completedCount).toBe(1);
  });

  it("productivity step is done when M365/Google connected", () => {
    const c = buildChecklist({ ...EMPTY, productivityConnected: true });
    expect(c.steps.find((s) => s.id === "connect_productivity")?.done).toBe(true);
  });

  it("vendors step is NOT done if a PHI vendor lacks a BAA", () => {
    const c = buildChecklist({ ...EMPTY, vendorCount: 2, phiVendorsMissingBaa: 1 });
    const v = c.steps.find((s) => s.id === "vendors");
    expect(v?.done).toBe(false);
    expect(v?.detail).toContain("need a BAA");
  });

  it("vendors step IS done when vendors exist and all PHI vendors have BAAs", () => {
    const c = buildChecklist({ ...EMPTY, vendorCount: 2, phiVendorsMissingBaa: 0 });
    expect(c.steps.find((s) => s.id === "vendors")?.done).toBe(true);
  });

  it("safeguards step is done only when no controls remain not_started", () => {
    expect(buildChecklist({ ...EMPTY, notStartedControls: 3 }).steps.find((s) => s.id === "safeguards")?.done).toBe(false);
    expect(buildChecklist({ ...EMPTY, notStartedControls: 0 }).steps.find((s) => s.id === "safeguards")?.done).toBe(true);
  });

  it("safeguards step shows 'X of Y reviewed' detail", () => {
    const c = buildChecklist({ ...EMPTY, notStartedControls: 4, totalControls: 12 });
    expect(c.steps.find((s) => s.id === "safeguards")?.detail).toBe("8 of 12 reviewed");
  });

  it("nextStep advances to the first incomplete step in order", () => {
    // team + productivity done; policies should be next
    const c = buildChecklist({ ...EMPTY, teamCount: 3, productivityConnected: true });
    expect(c.nextStep?.id).toBe("policies");
  });

  it("every step has plain-language why + whatToDo + a real href", () => {
    for (const s of buildChecklist(EMPTY).steps) {
      expect(s.why.length).toBeGreaterThan(20);
      expect(s.whatToDo.length).toBeGreaterThan(10);
      expect(s.href.startsWith("/app/")).toBe(true);
    }
  });
});
