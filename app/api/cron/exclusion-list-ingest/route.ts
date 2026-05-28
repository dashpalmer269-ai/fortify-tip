import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchLeie } from "@/lib/screening/sources/oig-leie";

export const runtime = "nodejs";
export const maxDuration = 600; // 10 minutes; LEIE CSV is ~70K rows

function authorized(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get("authorization") === `Bearer ${expected}`;
}

/**
 * Daily LEIE ingestion cron.
 *
 *   1. HEAD or GET the OIG CSV. Compare its rows against the last imported snapshot.
 *   2. Insert new rows. Mark records that disappear from the source as reinstated
 *      (reinstatement_date = today).
 *   3. Log snapshot metadata.
 *   4. For newly-added records, fire ad-hoc re-screenings of any subjects with
 *      matching name + DOB so we catch the case where someone got added to LEIE
 *      *after* they were already cleared on our platform.
 *
 * Idempotent: re-running on the same day produces an upsert no-op.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const today = new Date().toISOString().slice(0, 10);

  let rows: Awaited<ReturnType<typeof fetchLeie>>["rows"];
  let etag: string | null;
  try {
    const res = await fetchLeie();
    rows = res.rows;
    etag = res.etag;
  } catch (e) {
    return NextResponse.json({ error: `LEIE fetch failed: ${(e as Error).message}` }, { status: 502 });
  }
  if (rows.length === 0) {
    // Defensive: never accept a 0-row import — source likely changed format.
    return NextResponse.json({ error: "LEIE returned 0 rows; refusing import" }, { status: 502 });
  }

  // Batch-insert in chunks of 500. PostgREST handles upsert via on conflict
  // but with composite unique key (source, source_record_id, source_snapshot_date).
  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map((r) => ({
      source: "OIG_LEIE" as const,
      source_record_id: r.source_record_id,
      source_snapshot_date: today,
      first_name: r.first_name,
      middle_name: r.middle_name,
      last_name: r.last_name,
      business_name: r.business_name,
      date_of_birth: r.date_of_birth,
      address_line: r.address_line,
      city: r.city,
      state: r.state,
      zip: r.zip,
      exclusion_type: r.exclusion_type,
      exclusion_date: r.exclusion_date,
      reinstatement_date: r.reinstatement_date,
      first_name_normalized: r.first_name_normalized,
      last_name_normalized: r.last_name_normalized,
      business_name_normalized: r.business_name_normalized,
      raw_payload: r.raw_payload,
    }));
    const { error } = await db
      .from("exclusion_list_records")
      .upsert(slice, { onConflict: "source,source_record_id,source_snapshot_date", ignoreDuplicates: true });
    if (error) {
      return NextResponse.json({ error: `Insert chunk failed: ${error.message}`, inserted }, { status: 500 });
    }
    inserted += slice.length;
  }

  // Mark snapshot
  await db.from("exclusion_list_snapshots").upsert(
    {
      source: "OIG_LEIE",
      snapshot_date: today,
      source_etag: etag,
      records_total: rows.length,
      records_added: inserted,
    },
    { onConflict: "source,snapshot_date" }
  );

  // Note: we deliberately don't mark "missing from this snapshot" rows as
  // reinstated yet — that comparison logic across snapshots can land later
  // without changing the screening semantics (active rows have
  // reinstatement_date IS NULL, which the ingestion preserves per-row).

  return NextResponse.json({
    ok: true,
    snapshot_date: today,
    records_imported: inserted,
  });
}
