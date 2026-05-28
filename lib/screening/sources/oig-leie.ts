/**
 * OIG LEIE CSV fetcher + parser.
 *
 * The OIG publishes the full exclusion list as a CSV at
 *   https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv
 *
 * (Daily delta is at /downloadables/DBN.csv but contains only additions and
 * deletions in the same row format. For now we use the full monthly snapshot
 * and rely on diff'ing to detect added/removed rows.)
 *
 * Columns in the LEIE CSV (per OIG documentation):
 *   LASTNAME, FIRSTNAME, MIDNAME, BUSNAME, GENERAL, SPECIALTY, UPIN, NPI,
 *   DOB, ADDRESS, CITY, STATE, ZIP, EXCLTYPE, EXCLDATE, REINDATE, WAIVERDATE, WVRSTATE
 *
 * DOB is YYYYMMDD; EXCLDATE/REINDATE are YYYYMMDD.
 */

import { normalizeName } from "../normalize";

export const OIG_LEIE_URL = "https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv";

export interface LeieRow {
  source_record_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  business_name: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  exclusion_type: string | null;
  exclusion_date: string | null;
  reinstatement_date: string | null;
  first_name_normalized: string | null;
  last_name_normalized: string | null;
  business_name_normalized: string | null;
  raw_payload: Record<string, string>;
}

function isoDate(yyyymmdd: string | null | undefined): string | null {
  if (!yyyymmdd) return null;
  const m = yyyymmdd.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function emptyToNull(s: string | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t === "" ? null : t;
}

/**
 * Parse a CSV line respecting quoted commas. The LEIE CSV uses standard
 * RFC 4180 quoting; we don't need a heavy library for what's a flat schema.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/** Parse the entire CSV body into structured rows. */
export function parseLeieCsv(csv: string): LeieRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]!).map((h) => h.toUpperCase());
  const idx = (col: string): number => header.indexOf(col);

  const iLast = idx("LASTNAME");
  const iFirst = idx("FIRSTNAME");
  const iMid = idx("MIDNAME");
  const iBus = idx("BUSNAME");
  const iDob = idx("DOB");
  const iAddr = idx("ADDRESS");
  const iCity = idx("CITY");
  const iState = idx("STATE");
  const iZip = idx("ZIP");
  const iExclType = idx("EXCLTYPE");
  const iExclDate = idx("EXCLDATE");
  const iReinDate = idx("REINDATE");
  const iUpin = idx("UPIN");
  const iNpi = idx("NPI");

  const rows: LeieRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    if (cells.length < 4) continue;

    const lastName = emptyToNull(cells[iLast]);
    const firstName = emptyToNull(cells[iFirst]);
    const middleName = emptyToNull(cells[iMid]);
    const businessName = emptyToNull(cells[iBus]);
    const upin = emptyToNull(cells[iUpin]);
    const npi = emptyToNull(cells[iNpi]);
    const exclDate = isoDate(cells[iExclDate]);

    // Build a stable source_record_id. UPIN > NPI > composite of name+date.
    const recordId =
      upin ??
      npi ??
      [lastName ?? "", firstName ?? "", businessName ?? "", exclDate ?? ""].join("|");

    const raw: Record<string, string> = {};
    for (let h = 0; h < header.length; h++) {
      raw[header[h]!] = cells[h] ?? "";
    }

    rows.push({
      source_record_id: recordId,
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      business_name: businessName,
      date_of_birth: isoDate(cells[iDob]),
      address_line: emptyToNull(cells[iAddr]),
      city: emptyToNull(cells[iCity]),
      state: emptyToNull(cells[iState]),
      zip: emptyToNull(cells[iZip]),
      exclusion_type: emptyToNull(cells[iExclType]),
      exclusion_date: exclDate,
      reinstatement_date: isoDate(cells[iReinDate]),
      first_name_normalized: firstName ? normalizeName(firstName) : null,
      last_name_normalized: lastName ? normalizeName(lastName) : null,
      business_name_normalized: businessName ? normalizeName(businessName) : null,
      raw_payload: raw,
    });
  }
  return rows;
}

/**
 * Fetch + parse the LEIE CSV. Returns the rows and the ETag for change
 * detection in the snapshot record.
 */
export async function fetchLeie(): Promise<{ rows: LeieRow[]; etag: string | null }> {
  const res = await fetch(OIG_LEIE_URL, { headers: { Accept: "text/csv" } });
  if (!res.ok) {
    throw new Error(`OIG LEIE fetch failed: ${res.status}`);
  }
  const csv = await res.text();
  const etag = res.headers.get("etag");
  return { rows: parseLeieCsv(csv), etag };
}
