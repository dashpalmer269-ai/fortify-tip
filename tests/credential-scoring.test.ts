import { describe, expect, it } from "vitest";
import { scoreIntegrationCredentials } from "@/lib/security/credential-scoring";

function makeIntegration(overrides: Partial<Parameters<typeof scoreIntegrationCredentials>[0]> = {}) {
  return {
    integration_type: "microsoft_365",
    status: "connected",
    encrypted_credentials_bytes: "encrypted-blob",
    last_synced_at: new Date().toISOString(),
    scopes: ["User.Read.All", "AuditLog.Read.All"],
    ...overrides,
  };
}

describe("credential scoring", () => {
  it("a freshly connected M365 with read-only scopes scores 'high' or 'excellent'", () => {
    const s = scoreIntegrationCredentials(makeIntegration());
    expect(["high", "excellent"]).toContain(s.level);
    expect(s.score).toBeGreaterThanOrEqual(75);
  });

  it("missing encrypted blob scores 'critical'", () => {
    const s = scoreIntegrationCredentials(
      makeIntegration({ encrypted_credentials_bytes: null })
    );
    expect(s.level).toBe("critical");
  });

  it("never-synced integration loses the age component", () => {
    const s = scoreIntegrationCredentials(makeIntegration({ last_synced_at: null }));
    const ageFactor = s.factors.find((f) => f.axis === "age");
    expect(ageFactor?.points).toBe(0);
  });

  it("stale (>365d) sync zeros the age component", () => {
    const eighteenMonthsAgo = new Date(Date.now() - 540 * 86400_000).toISOString();
    const s = scoreIntegrationCredentials(
      makeIntegration({ last_synced_at: eighteenMonthsAgo })
    );
    const ageFactor = s.factors.find((f) => f.axis === "age");
    expect(ageFactor?.points).toBe(0);
  });

  it("broad write/admin scope penalizes the scope component", () => {
    const s = scoreIntegrationCredentials(
      makeIntegration({ scopes: ["Directory.ReadWrite.All", "*"] })
    );
    const scopeFactor = s.factors.find((f) => f.axis === "scope");
    expect(scopeFactor!.points).toBeLessThanOrEqual(3);
  });

  it("AWS (long-lived API key) scores lower on credential_type than M365 (OAuth)", () => {
    const aws = scoreIntegrationCredentials(makeIntegration({ integration_type: "aws" }));
    const m365 = scoreIntegrationCredentials(makeIntegration({ integration_type: "microsoft_365" }));
    const awsType = aws.factors.find((f) => f.axis === "credential_type")!;
    const m365Type = m365.factors.find((f) => f.axis === "credential_type")!;
    expect(awsType.points).toBeLessThan(m365Type.points);
  });
});
