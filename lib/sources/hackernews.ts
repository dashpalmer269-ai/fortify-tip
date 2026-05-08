import { RawThreatInput } from '../types';

const HN_API = 'https://hacker-news.firebaseio.com/v0';

const SECURITY_KEYWORDS = [
  'cve', 'vulnerability', 'exploit', 'breach', 'hack', 'malware', 'ransomware',
  'zero-day', '0day', 'phishing', 'supply chain', 'attack', 'security', 'patch',
  'rce', 'sqli', 'xss', 'csrf', 'idor', 'privilege escalation', 'backdoor',
];

interface HnStory {
  id: number;
  title: string;
  url?: string;
  text?: string;
  time: number;
  score: number;
  by: string;
  descendants?: number;
}

function isSecurityRelated(title: string): boolean {
  const lower = title.toLowerCase();
  return SECURITY_KEYWORDS.some(kw => lower.includes(kw));
}

export async function fetchHackerNews(): Promise<RawThreatInput[]> {
  const [newRes, topRes] = await Promise.all([
    fetch(`${HN_API}/newstories.json`),
    fetch(`${HN_API}/topstories.json`),
  ]);

  const newIds: number[] = await newRes.json();
  const topIds: number[] = await topRes.json();

  const ids = [...new Set([...newIds.slice(0, 200), ...topIds.slice(0, 100)])];

  const cutoff = Math.floor((Date.now() - 12 * 60 * 60 * 1000) / 1000);

  const stories = await Promise.allSettled(
    ids.slice(0, 50).map(id =>
      fetch(`${HN_API}/item/${id}.json`).then(r => r.json() as Promise<HnStory>)
    )
  );

  const results: RawThreatInput[] = [];
  for (const result of stories) {
    if (result.status !== 'fulfilled') continue;
    const story = result.value;
    if (!story || story.time < cutoff) continue;
    if (!isSecurityRelated(story.title)) continue;

    results.push({
      cve_id: null,
      title: story.title,
      affected_products: [],
      exploit_status: 'theoretical',
      reference_url: story.url ?? `https://news.ycombinator.com/item?id=${story.id}`,
      fix_status: 'fixing',
      severity: story.score > 100 ? 'high' : story.score > 50 ? 'medium' : 'low',
      source_name: 'Hacker News',
      source_tab: 'forums',
      raw_content: story.text ?? story.title,
      published_at: new Date(story.time * 1000).toISOString(),
    });
  }

  return results;
}
