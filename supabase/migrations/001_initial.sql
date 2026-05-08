-- Enable uuid extension
create extension if not exists "uuid-ossp";

-- Threats table
create table if not exists threats (
  id uuid primary key default uuid_generate_v4(),
  cve_id text,
  title text not null,
  summary text,
  affected_products text[],
  exploit_status text check (exploit_status in ('active', 'poc', 'theoretical', 'none')),
  reference_url text,
  fix_status text check (fix_status in ('patched', 'workaround', 'fixing')),
  severity text check (severity in ('critical', 'high', 'medium', 'low')),
  source_name text,
  source_tab text check (source_tab in ('registry', 'community', 'forums')),
  raw_content text,
  credibility_score integer check (credibility_score between 1 and 10),
  is_critical boolean default false,
  tags text[],
  published_at timestamptz,
  ingested_at timestamptz default now()
);

-- Ingestion logs table
create table if not exists ingestion_logs (
  id uuid primary key default uuid_generate_v4(),
  source text,
  items_fetched integer,
  items_new integer,
  status text,
  error_message text,
  ran_at timestamptz default now()
);

-- Indexes
create index if not exists idx_threats_cve_id on threats(cve_id);
create index if not exists idx_threats_source_tab on threats(source_tab);
create index if not exists idx_threats_severity on threats(severity);
create index if not exists idx_threats_is_critical on threats(is_critical);
create index if not exists idx_threats_ingested_at on threats(ingested_at desc);
create index if not exists idx_threats_published_at on threats(published_at desc);

-- Full-text search index across title + summary + raw_content
create index if not exists idx_threats_fts on threats
  using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(raw_content,'')));

-- RPC function used by the search API
create or replace function search_threats(query text)
returns setof threats
language sql
stable
as $$
  select *
  from threats
  where to_tsvector('english',
      coalesce(title,'') || ' ' ||
      coalesce(summary,'') || ' ' ||
      coalesce(raw_content,'')
    ) @@ websearch_to_tsquery('english', query)
  order by credibility_score desc nulls last
  limit 20;
$$;
