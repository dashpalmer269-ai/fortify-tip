import { RawThreatInput, Severity } from '../types';
import Parser from 'rss-parser';

const FEED_URL = 'https://www.bleepingcomputer.com/feed/';

const CRITICAL_KEYWORDS = ['ransomware', 'zero-day', '0-day', 'actively exploited', 'emergency patch'];
const HIGH_KEYWORDS = ['critical vulnerability', 'remote code execution', 'data breach', 'hack'];
const MEDIUM_KEYWORDS = ['vulnerability', 'patch', 'security update', 'flaw'];

function inferSeverity(title: string, content: string): Severity {
  const text = `${title} ${content}`.toLowerCase();
  if (CRITICAL_KEYWORDS.some(k => text.includes(k))) return 'critical';
  if (HIGH_KEYWORDS.some(k => text.includes(k))) return 'high';
  if (MEDIUM_KEYWORDS.some(k => text.includes(k))) return 'medium';
  return 'low';
}

function extractCve(text: string): string | null {
  const match = text.match(/CVE-\d{4}-\d{4,7}/i);
  return match ? match[0].toUpperCase() : null;
}

export async function fetchBleepingComputer(): Promise<RawThreatInput[]> {
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
        exploit_status: content.toLowerCase().includes('exploit') ? 'poc' : 'none',
        reference_url: item.link ?? FEED_URL,
        fix_status: content.toLowerCase().includes('patch') ? 'patched' : 'fixing',
        severity: inferSeverity(item.title ?? '', content),
        source_name: 'BleepingComputer',
        source_tab: 'forums',
        raw_content: content,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      };
    });
}
