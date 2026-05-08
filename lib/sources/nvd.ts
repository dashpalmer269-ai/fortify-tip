import { RawThreatInput, Severity, ExploitStatus, FixStatus } from '../types';

const NVD_API = 'https://services.nvd.nist.gov/rest/json/cves/2.0';

interface NvdCveItem {
  cve: {
    id: string;
    published: string;
    lastModified: string;
    vulnStatus: string;
    descriptions: Array<{ lang: string; value: string }>;
    metrics?: {
      cvssMetricV31?: Array<{ cvssData: { baseScore: number; baseSeverity: string } }>;
      cvssMetricV30?: Array<{ cvssData: { baseScore: number; baseSeverity: string } }>;
      cvssMetricV2?: Array<{ cvssData: { baseScore: number }; baseSeverity: string }>;
    };
    configurations?: Array<{
      nodes: Array<{ cpeMatch: Array<{ criteria: string }> }>;
    }>;
    references?: Array<{ url: string; tags?: string[] }>;
  };
}

function mapSeverity(s: string): Severity {
  const lower = s.toLowerCase();
  if (lower === 'critical') return 'critical';
  if (lower === 'high') return 'high';
  if (lower === 'medium' || lower === 'moderate') return 'medium';
  return 'low';
}

function extractProducts(item: NvdCveItem): string[] {
  const products: string[] = [];
  const configs = item.cve.configurations ?? [];
  for (const config of configs) {
    for (const node of config.nodes) {
      for (const cpe of node.cpeMatch ?? []) {
        const parts = cpe.criteria.split(':');
        if (parts[4]) products.push(parts[4].replace(/_/g, ' '));
      }
    }
  }
  return [...new Set(products)].slice(0, 10);
}

function determineExploitStatus(item: NvdCveItem): ExploitStatus {
  const refs = item.cve.references ?? [];
  const exploitTags = refs.flatMap(r => r.tags ?? []);
  if (exploitTags.some(t => t.toLowerCase().includes('exploit'))) return 'poc';
  return 'none';
}

function determineFixStatus(item: NvdCveItem): FixStatus {
  const refs = item.cve.references ?? [];
  const hasPatch = refs.some(r => (r.tags ?? []).some(t => t.toLowerCase().includes('patch') || t.toLowerCase().includes('fix')));
  if (hasPatch) return 'patched';
  const status = item.cve.vulnStatus?.toLowerCase() ?? '';
  if (status.includes('analyzed') || status.includes('modified')) return 'workaround';
  return 'fixing';
}

export async function fetchNvdCves(): Promise<RawThreatInput[]> {
  // NVD requires format: 2021-08-04T00:00:00.000 (with milliseconds, no Z)
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000)
    .toISOString()
    .replace('Z', '');
  const now = new Date().toISOString().replace('Z', '');
  const params = new URLSearchParams({
    pubStartDate: since,
    pubEndDate: now,
    resultsPerPage: '100',
  });

  const headers: HeadersInit = { 'User-Agent': 'Fortify-TIP/1.0' };
  if (process.env.NVD_API_KEY) headers['apiKey'] = process.env.NVD_API_KEY;

  const res = await fetch(`${NVD_API}?${params}`, { headers });
  if (!res.ok) throw new Error(`NVD API error: ${res.status}`);

  const data = await res.json() as { vulnerabilities: NvdCveItem[] };
  const items = data.vulnerabilities ?? [];

  return items.map((item): RawThreatInput => {
    const cve = item.cve;
    const desc = cve.descriptions.find(d => d.lang === 'en')?.value ?? cve.id;

    const metrics = cve.metrics;
    const cvss31 = metrics?.cvssMetricV31?.[0]?.cvssData;
    const cvss30 = metrics?.cvssMetricV30?.[0]?.cvssData;
    const severityStr = cvss31?.baseSeverity ?? cvss30?.baseSeverity ?? 'low';

    const refUrl = cve.references?.[0]?.url ?? `https://nvd.nist.gov/vuln/detail/${cve.id}`;

    return {
      cve_id: cve.id,
      title: `${cve.id}: ${desc.slice(0, 120)}`,
      affected_products: extractProducts(item),
      exploit_status: determineExploitStatus(item),
      reference_url: refUrl,
      fix_status: determineFixStatus(item),
      severity: mapSeverity(severityStr),
      source_name: 'NVD/NIST',
      source_tab: 'registry',
      raw_content: desc,
      published_at: cve.published,
    };
  });
}
