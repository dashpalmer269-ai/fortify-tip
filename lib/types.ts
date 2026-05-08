export type ExploitStatus = 'active' | 'poc' | 'theoretical' | 'none';
export type FixStatus = 'patched' | 'workaround' | 'fixing';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type SourceTab = 'registry' | 'community' | 'forums';

export interface Threat {
  id: string;
  cve_id: string | null;
  title: string;
  summary: string | null;
  affected_products: string[] | null;
  exploit_status: ExploitStatus | null;
  reference_url: string | null;
  fix_status: FixStatus | null;
  severity: Severity | null;
  source_name: string | null;
  source_tab: SourceTab | null;
  raw_content: string | null;
  credibility_score: number | null;
  is_critical: boolean | null;
  tags: string[] | null;
  published_at: string | null;
  ingested_at: string;
}

export interface IngestionLog {
  id: string;
  source: string;
  items_fetched: number;
  items_new: number;
  status: string;
  error_message: string | null;
  ran_at: string;
}

export interface RawThreatInput {
  cve_id?: string | null;
  title: string;
  affected_products?: string[];
  exploit_status?: ExploitStatus;
  reference_url?: string;
  fix_status?: FixStatus;
  severity?: Severity;
  source_name: string;
  source_tab: SourceTab;
  raw_content?: string;
  published_at?: string;
}
