# Fortify — Threat Intelligence Platform

Real-time cybersecurity threat intelligence powered by AI. Aggregates CVEs, CISA KEV, OTX pulses, and security news, enriched by Claude.

## Stack

- **Next.js 16** (App Router) — full-stack framework
- **Supabase** — PostgreSQL database + service client
- **Anthropic Claude** (claude-sonnet-4-6) — AI enrichment + search synthesis
- **Vercel** — hosting + cron jobs (2x daily ingestion)
- **Tailwind CSS v4** — styling

## Setup

### 1. Supabase

```bash
# Create a new Supabase project at supabase.com
# Run the migration in the SQL editor:
cat supabase/migrations/001_initial.sql
```

### 2. Environment Variables

Copy `.env.local` and fill in your keys:

```bash
ANTHROPIC_API_KEY=sk-ant-...          # Anthropic console
NEXT_PUBLIC_SUPABASE_URL=https://...  # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=...         # Supabase service role key
NVD_API_KEY=...                       # nvd.nist.gov/developers (free, optional but raises rate limits)
OTX_API_KEY=...                       # otx.alienvault.com account
CRON_SECRET=...                       # Any random secret string
```

### 3. Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Trigger Ingestion Manually

```bash
curl "http://localhost:3000/api/cron/ingest?secret=YOUR_CRON_SECRET"
```

### 5. Deploy

```bash
npm install -g vercel
vercel --prod
```

Set all environment variables in the Vercel dashboard (Project → Settings → Environment Variables). Also add `CRON_SECRET` so Vercel's cron can authenticate.

Vercel crons run at **06:00 UTC** and **18:00 UTC** daily, automatically hitting `/api/cron/ingest`.

## Project Structure

```
app/
  page.tsx                  Home — animated sphere, tab cards, search
  registry/page.tsx         NVD + CISA KEV vulnerabilities
  community/page.tsx        AlienVault OTX pulses
  forums/page.tsx           HN + BleepingComputer + Krebs
  search/page.tsx           AI-powered search results
  threat/[id]/page.tsx      Full threat detail
  api/cron/ingest/route.ts  Cron ingestion handler
  api/search/route.ts       Search endpoint

components/
  AnimatedSphere.tsx        Canvas particle-network sphere
  StarfieldBackground.tsx   Canvas starfield
  PerspectiveGrid.tsx       SVG floor grid
  ThreatCard.tsx            Threat list card

lib/
  types.ts                  TypeScript interfaces
  supabase/client.ts        Browser Supabase client
  supabase/server.ts        Server Supabase client (service role)
  sources/nvd.ts            NVD/NIST CVE adapter
  sources/cisa.ts           CISA KEV adapter
  sources/otx.ts            AlienVault OTX adapter
  sources/hackernews.ts     Hacker News adapter
  sources/bleepingcomputer.ts  BleepingComputer RSS adapter
  sources/krebs.ts          Krebs on Security RSS adapter
  ai/processor.ts           Claude enrichment + search synthesis

supabase/migrations/
  001_initial.sql           threats + ingestion_logs schema
```
# fortifydefense
