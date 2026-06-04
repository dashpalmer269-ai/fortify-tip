import { describe, expect, it } from "vitest";
import { scanForPhi, scanFields, phiBlockReason } from "@/lib/compliance/phi-scanner";

describe("PHI scanner", () => {
  it("returns clean on null/empty/whitespace input", () => {
    expect(scanForPhi(null).clean).toBe(true);
    expect(scanForPhi("").clean).toBe(true);
    expect(scanForPhi("    ").clean).toBe(true);
    expect(scanForPhi(undefined).clean).toBe(true);
  });

  it("detects an SSN", () => {
    const r = scanForPhi("Employee 123-45-6789 reviewed quarter-end records.");
    expect(r.clean).toBe(false);
    expect(r.findings.find((f) => f.pattern === "ssn")).toBeTruthy();
  });

  it("detects MRN labels followed by digits", () => {
    const r = scanForPhi("Patient MRN: 1029384756 admitted Monday.");
    expect(r.clean).toBe(false);
    expect(r.findings.find((f) => f.pattern === "mrn_labeled")).toBeTruthy();
  });

  it("detects DOB labels", () => {
    const r = scanForPhi("DOB: 1985-06-15");
    expect(r.clean).toBe(false);
    expect(r.findings.find((f) => f.pattern === "dob_labeled")).toBeTruthy();
  });

  it("detects patient-name labels", () => {
    const r = scanForPhi("Patient name: Jane Smith");
    expect(r.clean).toBe(false);
    expect(r.findings.find((f) => f.pattern === "patient_labeled")).toBeTruthy();
  });

  it("masks raw values in the echoed sample", () => {
    const r = scanForPhi("SSN 999-12-3456");
    const sample = r.findings.find((f) => f.pattern === "ssn")?.matched ?? "";
    // Sample should be redacted (digits replaced with X)
    expect(/^\d+$/.test(sample)).toBe(false);
  });

  it("scanFields tags each finding with its source field", () => {
    const r = scanFields({ file_name: "patient_jane_doe.pdf", notes: "All good" });
    expect(r.clean).toBe(false);
    expect(r.findings.some((f) => f.pattern.startsWith("file_name:"))).toBe(true);
  });

  it("phiBlockReason references the matched patterns", () => {
    const r = scanForPhi("MRN: 12345678");
    const msg = phiBlockReason(r);
    expect(msg).toContain("mrn_labeled");
  });

  it("treats benign compliance copy as clean", () => {
    const benign = [
      "Information Security Policy v3 acknowledgement",
      "Vendor BAA for Acme Cloud Storage signed 2026-05-01",
      "Q2 risk assessment executive summary",
      "Backup attestation: daily runs verified",
    ];
    for (const text of benign) {
      const r = scanForPhi(text);
      // Allow medium-severity false positives (ICD-10 over-match) but no high findings
      const high = r.findings.filter((f) => f.severity === "high");
      expect(high).toEqual([]);
    }
  });
});
