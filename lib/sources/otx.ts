import { RawThreatInput, Severity } from '../types';

const OTX_API = 'https://otx.alienvault.com/api/v1/pulses/subscribed';

interface OtxPulse {
  id: string;
  name: string;
  description: string;
  created: string;
  modified: string;
  tlp: string;
  tags: string[];
  references: string[];
  targeted_countries: string[];
  adversary: string;
  malware_families: string[];
  attack_ids: string[];
  industries: string[];
  indicators?: Array<{ type: string; indicator: string }>;
  cvelist?: string[];
}

function inferSeverity(pulse: OtxPulse): Severity {
  if (pulse.tlp === 'red' || pulse.malware_families.length > 0) return 'critical';
  if (pulse.adversary) return 'high';
  if (pulse.attack_ids.length > 0) return 'medium';
  return 'low';
}

function extractProducts(pulse: OtxPulse): string[] {
  const products: string[] = [];
  if (pulse.industries?.length) products.push(...pulse.industries);
  if (pulse.malware_families?.length) products.push(...pulse.malware_families);
  return [...new Set(products)].slice(0, 8);
}

export async function fetchOtxPulses(): Promise<RawThreatInput[]> {
  const key = process.env.OTX_API_KEY;
  if (!key) throw new Error('OTX_API_KEY not set');

  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const res = await fetch(`${OTX_API}?modified_since=${since}&limit=50`, {
    headers: { 'X-OTX-API-KEY': key },
  });
  if (!res.ok) throw new Error(`OTX API error: ${res.status}`);

  const data = await res.json() as { results: OtxPulse[] };
  const items = data.results ?? [];

  return items.map((pulse): RawThreatInput => ({
    cve_id: pulse.cvelist?.[0] ?? null,
    title: pulse.name,
    affected_products: extractProducts(pulse),
    exploit_status: pulse.malware_families.length > 0 ? 'active' : 'theoretical',
    reference_url: pulse.references?.[0] ?? `https://otx.alienvault.com/pulse/${pulse.id}`,
    fix_status: 'fixing',
    severity: inferSeverity(pulse),
    source_name: 'AlienVault OTX',
    source_tab: 'community',
    raw_content: pulse.description,
    published_at: pulse.created,
  }));
}
