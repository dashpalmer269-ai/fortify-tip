-- 014_billing_columns.sql
-- Billing state columns on practices, populated by the Stripe webhook handler
-- at /api/billing/webhook. Until a paid subscription lands, billing_status
-- defaults to 'trialing' so downstream code can branch cleanly.

alter table practices
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_status text not null default 'trialing'
    check (billing_status in ('trialing','active','past_due','canceled','unpaid','incomplete')),
  add column if not exists subscription_current_period_end timestamptz;

create index if not exists idx_practices_stripe_sub
  on practices (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists idx_practices_stripe_customer
  on practices (stripe_customer_id) where stripe_customer_id is not null;
