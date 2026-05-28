/**
 * Two-tier exclusion-list matcher.
 *
 * Tier 1 (initial screening):
 *   - Exact: last + first + DOB → service-role indexed lookup, sub-ms
 *   - Fallback: trigram similarity ≥ 0.85 on last + first, DOB exact
 *
 * Tier 2 (verification, only after tier-1 hits):
 *   - For each matched record, apply middle-name + address probes that the
 *     user provides. A probe RULES OUT a match if the user's value clearly
 *     differs from the LEIE/SAM value. Records that survive all probes
 *     remain in the match set.
 *
 * Tier-1 fuzziness is intentional — false positives are recoverable via
 * tier-2 disambiguation. False negatives are regulatory liability.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { normalizeName, normalizeAddress } from "./normalize";

type Db = SupabaseClient<Database>;

export interface MatchedRecord {
  id: string;
  source: "OIG_LEIE" | "SAM_GOV";
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  business_name: string | null;
  date_of_birth: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  exclusion_type: string | null;
  exclusion_date: string | null;
}

export interface Tier1Input {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO YYYY-MM-DD
}

export interface Tier2Probe {
  middleName?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/* ──────────────────────────────────────────────────────────────────────── *
 * Tier 1: find candidates by exact name+DOB, fuzzy fallback
 * ──────────────────────────────────────────────────────────────────────── */

const FUZZY_SIMILARITY_THRESHOLD = 0.85;

export async function tier1Match(db: Db, input: Tier1Input): Promise<MatchedRecord[]> {
  const first = normalizeName(input.firstName);
  const last = normalizeName(input.lastName);

  // Exact path
  const { data: exactMatches } = await db
    .from("exclusion_list_records")
    .select(
      "id, source, first_name, middle_name, last_name, business_name, date_of_birth, address_line, city, state, zip, exclusion_type, exclusion_date"
    )
    .eq("last_name_normalized", last)
    .eq("first_name_normalized", first)
    .eq("date_of_birth", input.dateOfBirth)
    .is("reinstatement_date", null);

  if (exactMatches && exactMatches.length > 0) {
    return exactMatches as MatchedRecord[];
  }

  // Fuzzy path: trigram similarity on names + DOB exact.
  // Uses an RPC because the JS client doesn't natively expose pg_trgm operators.
  const { data: fuzzyMatches } = await db.rpc("match_exclusion_fuzzy", {
    p_first_normalized: first,
    p_last_normalized: last,
    p_dob: input.dateOfBirth,
    p_threshold: FUZZY_SIMILARITY_THRESHOLD,
  });

  return (fuzzyMatches ?? []) as MatchedRecord[];
}

/* ──────────────────────────────────────────────────────────────────────── *
 * Tier 2: rule-out by middle name + address
 * ──────────────────────────────────────────────────────────────────────── */

export function tier2Filter(
  candidates: MatchedRecord[],
  probe: Tier2Probe
): MatchedRecord[] {
  const probeMiddle = probe.middleName ? normalizeName(probe.middleName) : null;
  const probeAddr = probe.addressLine ? normalizeAddress(probe.addressLine) : null;
  const probeZip = probe.zip?.trim() || null;
  const probeState = probe.state ? probe.state.trim().toUpperCase() : null;

  return candidates.filter((r) => {
    // Middle name rule-out: only if BOTH sides provide a value AND they differ.
    if (probeMiddle && r.middle_name) {
      const recMiddle = normalizeName(r.middle_name);
      if (recMiddle && recMiddle !== probeMiddle) {
        // Mismatched middle name — this record is not the same person.
        return false;
      }
    }

    // Address rule-out: only if BOTH sides have address data AND they differ.
    if (probeAddr && r.address_line) {
      const recAddr = normalizeAddress(r.address_line);
      const addrSimilar = recAddr && trigramScore(recAddr, probeAddr) >= 0.7;
      if (!addrSimilar) {
        // State + ZIP cross-check: if state differs AND zip differs, definitely not the same address.
        const stateMismatch = probeState && r.state && r.state.toUpperCase() !== probeState;
        const zipMismatch = probeZip && r.zip && r.zip.trim() !== probeZip;
        if (stateMismatch || zipMismatch) return false;
        if (!stateMismatch && !zipMismatch && !addrSimilar) return false;
      }
    }

    return true; // survives — still a plausible match
  });
}

/**
 * Cheap JS trigram-style similarity (Jaccard over character trigrams).
 * Mirrors pg_trgm's similarity() closely enough for tier-2 address checks.
 */
function trigramScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const trigrams = (s: string): Set<string> => {
    const padded = `  ${s}  `;
    const set = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    return set;
  };
  const A = trigrams(a);
  const B = trigrams(b);
  let intersect = 0;
  for (const t of A) if (B.has(t)) intersect++;
  const union = A.size + B.size - intersect;
  return union === 0 ? 0 : intersect / union;
}
