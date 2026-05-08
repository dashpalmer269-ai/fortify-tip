import { RawThreatInput, Severity } from '../types';
import Parser from 'rss-parser';

const FEED_URL = 'https://krebsonsecurity.com/feed/';

const SEVERITY_MAP: { keywords: string[]; severity: Severity }[] = [
  { keywords: ['ransomware', 'zero-day', 'breach', 'million records'], severity: 'critical' },
  { keywords: ['vulnerability', 'exploit', 'hack', 'attack', 'flaw'], severity: 'high' },
  { keywords: ['patch', 'update', 'scam', 'fraud', 'phishing'], severity: 'medium' },
];

function inferSeverity(title: string, content: string): Severity {
  const text = `${title} ${content}`.toLowerCase();
  for (const { keywords, severity } of SEVERITY_MAP) {
    if (keywords.some(k => text.includes(k))) return severity;
  }
  return 'low';
}

function extractCve(text: string): string | null {
  const match = text.match(/CVE-\d{4}-\d{4,7}/i);
  return match ? match[0].toUpperCase() : null;
}

export async function fetchKrebs(): Promise<RawThreatInput[]> {
  const parser = new Parser({ timeout: 15000 });
  const feed = await parser.parseURL(FEED_URL);

  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);

  return (feed.items ?? [])
    .filter(item => item.pubDate && new Date(item.pubDate) >= cutoff)
    .map((item): RawThreatInput => {
      const content = item.contentSnippet ?? item.content ?? item.title ?? '';
      return {
        cve_id: extractCve(`${item.title} ${content}`),
        title: item.title ?? 'Untitled',
        affected_products: [],
        exploit_status: content.toLowerCase().includes('ransomware') ? 'active' : 'none',
        reference_url: item.link ?? FEED_URL,
        fix_status: content.toLowerCase().includes('patch') ? 'patched' : 'fixing',
        severity: inferSeverity(item.title ?? '', content),
        source_name: 'Krebs on Security',
        source_tab: 'forums',
        raw_content: content,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      };
    });
}
