-- ─────────────────────────────────────────────────────────────────────────────
-- 003_vendors_baas.sql
-- Vendor + Business Associate Agreement tables. Drive the
-- all_phi_vendors_have_baa evidence check that already exists in the library.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  vendor_name text not null,
  vendor_type text,                    -- 'emr' | 'billing' | 'lab' | 'cloud' | 'msp' | 'other'
  phi_access boolean default false,
  contact_email text,
  contact_name text,
  website_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (practice_id, vendor_name)
);

create index if not exists idx_vendors_practice on vendors(practice_id);
create index if not exists idx_vendors_phi on vendors(practice_id) where phi_access;

create table if not exists baas (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  status text not null check (status in ('active','pending','expired','terminated')) default 'pending',
  signed_date date,
  expiration_date date,
  document_url text,                   -- supabase storage path
  signed_by text,                      -- counterparty signatory name
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_baas_practice on baas(practice_id);
create index if not exists idx_baas_vendor on baas(vendor_id);
create index if not exists idx_baas_expiration on baas(expiration_date) where status = 'active';

-- updated_at triggers
drop trigger if exists vendors_touch on vendors;
create trigger vendors_touch before update on vendors
  for each row execute function touch_updated_at();
drop trigger if exists baas_touch on baas;
create trigger baas_touch before update on baas
  for each row execute function touch_updated_at();

-- RLS — same pattern as the rest of the tenant tables
alter table vendors enable row level security;
alter table baas    enable row level security;

drop policy if exists vendors_member_read on vendors;
create policy vendors_member_read on vendors for select using (
  practice_id in (select practice_id from practice_users where user_id = auth.uid())
);
drop policy if exists vendors_officer_write on vendors;
create policy vendors_officer_write on vendors for all using (
  practice_id in (select practice_id from practice_users
                  where user_id = auth.uid()
                    and role in ('owner','admin','compliance_officer'))
);

drop policy if exists baas_member_read on baas;
create policy baas_member_read on baas for select using (
  practice_id in (select practice_id from practice_users where user_id = auth.uid())
);
drop policy if exists baas_officer_write on baas;
create policy baas_officer_write on baas for all using (
  practice_id in (select practice_id from practice_users
                  where user_id = auth.uid()
                    and role in ('owner','admin','compliance_officer'))
);

grant all on vendors to service_role;
grant all on baas to service_role;
