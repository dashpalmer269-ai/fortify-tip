/**
 * Integration credential strength scoring.
 *
 * For every connected integration we compute a 0-100 score across four axes:
 *
 *   ENCRYPTION (40)   sealed via the KMS helper (encrypted_credentials_bytes)
 *                     vs missing/invalid storage
 *   CREDENTIAL TYPE (25)
 *                     OAuth refreshable (best) > short-lived service-account
 *                     > long-lived API key/secret (worst)
 *   AGE (20)          how long since last_synced_at; older = stronger penalty
 *   SCOPE (15)        least-privilege markers in the `scopes` column
 *
 * The result feeds the `integration_credential_strength` evidence check
 * (cron sweeps it; fails if any connected integration is below threshold),
 * and is surfaced per-integration in the UI so the admin can act.
 *
 * Pure function — no DB calls. Caller passes the integration row shape.
 */

export type CredentialRiskLevel = "critical" | "low" | "medium" | "high" | "excellent";

export interface IntegrationForScoring {
  integration_type: string;
  status: string;
  encrypted_credentials_bytes: string | null;
  last_synced_at: string | null;
  scopes: string[] | null;
}

export interface CredentialScore {
  score: number;            // 0..100
  level: CredentialRiskLevel;
  factors: Array<{ axis: string; points: number; max: number; note: string }>;
}

const TYPE_PROFILE: Record<string, { points: number; note: string }> = {
  microsoft_365:    { points: 22, note: "OAuth refresh-token capable" },
  google_workspace: { points: 22, note: "OAuth refresh-token capable" },
  okta:             { points: 12, note: "long-lived API token (SSWS)" },
  aws:              { points: 10, note: "long-lived IAM access key" },
  azure_ad:         { points: 22, note: "OAuth refresh-token capable" },
  datto:            { points: 12, note: "long-lived API token" },
  connectwise:      { points: 12, note: "long-lived API token" },
};

function levelFor(score: number): CredentialRiskLevel {
  if (score >= 90) return "excellent";
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  if (score >= 30) return "low";
  return "critical";
}

export function scoreIntegrationCredentials(i: IntegrationForScoring): CredentialScore {
  const factors: CredentialScore["factors"] = [];

  // 1. Encryption (40) — non-negotiable
  if (i.encrypted_credentials_bytes && i.status === "connected") {
    factors.push({ axis: "encryption", points: 40, max: 40, note: "sealed via KMS helper" });
  } else if (i.encrypted_credentials_bytes) {
    // disconnected with encrypted blob still exists
    factors.push({ axis: "encryption", points: 30, max: 40, note: "sealed but integration is disconnected" });
  } else {
    factors.push({
      axis: "encryption",
      points: 0,
      max: 40,
      note: "no encrypted credentials on file — reconnect required",
    });
  }

  // 2. Credential type (25)
  const profile = TYPE_PROFILE[i.integration_type] ?? {
    points: 8,
    note: "unrecognized credential type — defaulting to low",
  };
  factors.push({ axis: "credential_type", points: profile.points, max: 25, note: profile.note });

  // 3. Age (20) — how long since last sync (proxy for rotation cadence)
  if (i.last_synced_at) {
    const ageDays = Math.floor((Date.now() - new Date(i.last_synced_at).getTime()) / 86400_000);
    let agePts: number;
    let ageNote: string;
    if (ageDays < 30) {
      agePts = 20;
      ageNote = `synced ${ageDays}d ago — fresh`;
    } else if (ageDays < 90) {
      agePts = 15;
      ageNote = `${ageDays}d since last sync`;
    } else if (ageDays < 180) {
      agePts = 8;
      ageNote = `${ageDays}d since last sync — consider rotation`;
    } else if (ageDays < 365) {
      agePts = 4;
      ageNote = `${ageDays}d since last sync — rotate now`;
    } else {
      agePts = 0;
      ageNote = `${ageDays}d since last sync — credential likely stale`;
    }
    factors.push({ axis: "age", points: agePts, max: 20, note: ageNote });
  } else {
    factors.push({ axis: "age", points: 0, max: 20, note: "never synced" });
  }

  // 4. Scope (15) — least-privilege signal
  const scopes = i.scopes ?? [];
  let scopePts = 0;
  let scopeNote = "no scope information";
  if (scopes.length > 0) {
    const hasReadOnly = scopes.some(
      (s) => /^([a-z0-9_-]+:)?(read|get|list|describe)/i.test(s) || /\.read$|\.read\.all$/i.test(s)
    );
    const hasWriteOrFull = scopes.some(
      (s) => /(write|admin|\*|full|delete|put)/i.test(s)
    );
    if (hasReadOnly && !hasWriteOrFull) {
      scopePts = 15;
      scopeNote = "scoped to read-only";
    } else if (hasReadOnly && hasWriteOrFull) {
      scopePts = 8;
      scopeNote = "mixed read + write scopes";
    } else if (hasWriteOrFull) {
      scopePts = 3;
      scopeNote = "broad write/admin scopes — narrow to least privilege";
    } else {
      scopePts = 10;
      scopeNote = `${scopes.length} scope(s) configured`;
    }
  }
  factors.push({ axis: "scope", points: scopePts, max: 15, note: scopeNote });

  const score = factors.reduce((s, f) => s + f.points, 0);

  // Invariant: encryption is non-negotiable. If the encryption axis scored
  // zero (no sealed blob on file), the integration is "critical" regardless
  // of the other axes — there is no real security without it.
  const encryption = factors.find((f) => f.axis === "encryption");
  const level: CredentialRiskLevel =
    encryption && encryption.points === 0 ? "critical" : levelFor(score);

  return { score, level, factors };
}
