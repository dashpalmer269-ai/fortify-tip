import { RawThreatInput } from '../types';

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

interface CisaVulnerability {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
  notes: string;
}

export async function fetchCisaKev(): Promise<RawThreatInput[]> {
  const res = await fetch(CISA_KEV_URL);
  if (!res.ok) throw new Error(`CISA KEV error: ${res.status}`);

  const data = await res.json() as { vulnerabilities: CisaVulnerability[] };
  const items = data.vulnerabilities ?? [];

  // Only return entries added in the last 12 hours
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);

  return items
    .filter(v => new Date(v.dateAdded) >= cutoff)
    .map((v): RawThreatInput => ({
      cve_id: v.cveID,
      title: `${v.cveID}: ${v.vulnerabilityName}`,
      affected_products: [`${v.vendorProject} ${v.product}`.trim()],
      exploit_status: 'active',
      reference_url: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog`,
      fix_status: v.requiredAction?.toLowerCase().includes('patch') ? 'patched' : 'workaround',
      severity: 'critical',
      source_name: 'CISA KEV',
      source_tab: 'registry',
      raw_content: `${v.shortDescription} Required action: ${v.requiredAction}. ${v.notes ?? ''}`.trim(),
      published_at: v.dateAdded,
    }));
}
