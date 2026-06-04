import { describe, expect, it } from "vitest";
import { narrativeStateHash } from "@/lib/dashboard/narrative";

describe("dashboard narrative state hash", () => {
  it("is deterministic for the same input", () => {
    const a = narrativeStateHash({
      overall_pct: 82,
      critical_open: 2,
      top_task_signatures: ["t1:open:2026-06-01", "t2:open:2026-06-05"],
    });
    const b = narrativeStateHash({
      overall_pct: 82,
      critical_open: 2,
      top_task_signatures: ["t1:open:2026-06-01", "t2:open:2026-06-05"],
    });
    expect(a).toBe(b);
  });

  it("is order-independent on the task signatures", () => {
    const a = narrativeStateHash({
      overall_pct: 82,
      critical_open: 2,
      top_task_signatures: ["t1:open:2026-06-01", "t2:open:2026-06-05"],
    });
    const b = narrativeStateHash({
      overall_pct: 82,
      critical_open: 2,
      top_task_signatures: ["t2:open:2026-06-05", "t1:open:2026-06-01"],
    });
    expect(a).toBe(b);
  });

  it("changes when the score changes", () => {
    const a = narrativeStateHash({
      overall_pct: 82,
      critical_open: 2,
      top_task_signatures: ["t1:open:2026-06-01"],
    });
    const b = narrativeStateHash({
      overall_pct: 83,
      critical_open: 2,
      top_task_signatures: ["t1:open:2026-06-01"],
    });
    expect(a).not.toBe(b);
  });

  it("changes when a task signature changes", () => {
    const a = narrativeStateHash({
      overall_pct: 82,
      critical_open: 2,
      top_task_signatures: ["t1:open:2026-06-01"],
    });
    const b = narrativeStateHash({
      overall_pct: 82,
      critical_open: 2,
      top_task_signatures: ["t1:done:2026-06-01"],
    });
    expect(a).not.toBe(b);
  });
});
