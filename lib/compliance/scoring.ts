/**
 * Audit-readiness scoring wrappers.
 * The heavy lifting lives in SQL functions audit_readiness() and
 * audit_readiness_summary() defined in 002_compliance_schema.sql.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FrameworkReadiness {
  framework: string;
  satisfied_requirements: number;
  total_requirements: number;
  weighted_pct: number;
  category_breakdown: Record<string, { satisfied: number; total: number; weighted_pct: number }>;
}

export interface ReadinessSummaryRow {
  framework_code: string;
  weighted_pct: number;
  satisfied: number;
  total: number;
}

export async function getReadiness(
  supabase: SupabaseClient,
  practiceId: string,
  frameworkCode: string
): Promise<FrameworkReadiness | null> {
  const { data, error } = await supabase.rpc("audit_readiness", {
    p_practice_id: practiceId,
    p_framework_code: frameworkCode,
  });
  if (error) throw new Error(`audit_readiness failed: ${error.message}`);
  return (data?.[0] ?? null) as FrameworkReadiness | null;
}

export async function getReadinessSummary(
  supabase: SupabaseClient,
  practiceId: string
): Promise<ReadinessSummaryRow[]> {
  const { data, error } = await supabase.rpc("audit_readiness_summary", {
    p_practice_id: practiceId,
  });
  if (error) throw new Error(`audit_readiness_summary failed: ${error.message}`);
  return (data ?? []) as ReadinessSummaryRow[];
}
