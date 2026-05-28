/**
 * Name + address normalization for exclusion-screening matching.
 *
 * Canonicalization principles:
 *   - Upper-case (case-insensitive matching)
 *   - NFKD decomposition + strip combining marks (handles accented letters)
 *   - Drop common suffixes (Jr, Sr, II, III, IV, MD, DO, etc.)
 *   - Collapse internal whitespace
 *   - Trim outer whitespace and punctuation
 *
 * The same normalization runs on inbound user input AND on LEIE/SAM records at
 * ingest time, so we compare apples to apples.
 */

const SUFFIX_RE =
  /\s*[, ]\s*(?:JR\.?|SR\.?|II|III|IV|V|MD|DO|RN|LPN|NP|PA|ESQ\.?|PHD)\.?\s*$/i;

const STRIP_PUNCT_RE = /[^\p{L}\p{N}\s'-]/gu;

export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.normalize("NFKD");
  s = s.replace(/[̀-ͯ]/g, ""); // strip combining marks
  s = s.replace(STRIP_PUNCT_RE, " ");
  s = s.toUpperCase();
  // Iteratively strip suffixes (someone might be "Foo Jr II")
  let prev: string;
  do {
    prev = s;
    s = s.replace(SUFFIX_RE, "");
  } while (s !== prev);
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Normalize first + last in one call. */
export function normalizePersonName(
  first: string | null | undefined,
  last: string | null | undefined
): { first: string; last: string } {
  return { first: normalizeName(first), last: normalizeName(last) };
}

/**
 * Normalize an address line for fuzzy comparison. Lowercased here because we
 * use trigram similarity which is case-insensitive in our config.
 *
 * Strips suite/apt indicators because LEIE often stores street only.
 */
export function normalizeAddress(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  s = s.toUpperCase();
  // Common street suffix abbreviations to standard form
  s = s
    .replace(/\bSTREET\b/g, "ST")
    .replace(/\bAVENUE\b/g, "AVE")
    .replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bROAD\b/g, "RD")
    .replace(/\bDRIVE\b/g, "DR")
    .replace(/\bLANE\b/g, "LN")
    .replace(/\bCOURT\b/g, "CT")
    .replace(/\bSUITE\s+\S+/g, "")
    .replace(/\bAPT\.?\s+\S+/g, "")
    .replace(/\bUNIT\s+\S+/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Cheap normalized equality. */
export function nameEquals(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  return normalizeName(a) === normalizeName(b);
}
