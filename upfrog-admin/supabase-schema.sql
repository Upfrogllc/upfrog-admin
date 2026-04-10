-- ================================================================
-- UPFROG SUPABASE SCHEMA
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- ── CLIENTS TABLE ─────────────────────────────────────────────
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  name          text not null,
  slug          text unique not null,
  email         text,
  phone         text,
  city          text,
  state         text,
  zip           text,
  service_area  text,
  domain        text,
  brand_color   text default '#c0572a',
  brand_color_alt text default '#2d2a26',
  logo_url      text,
  meta_pixel_id text,
  ga_measurement_id text,
  portal_email  text unique,
  portal_enabled boolean default false,
  portal_last_login timestamptz,
  status        text default 'draft',
  notes         text,
  ghl_location_id   text,
  ghl_webhook_url   text,
  ghl_calendar_url  text
);

-- ── LEADS TABLE ───────────────────────────────────────────────
create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),

  -- Which client + vertical
  client_id       uuid references clients(id) on delete cascade,
  client_slug     text,
  vertical        text not null default 'roofing',

  -- Homeowner identity
  first_name      text,
  last_name       text,
  email           text,
  phone           text,

  -- Property
  address         text,
  lat             numeric,
  lng             numeric,

  -- Form answers
  roof_type       text,
  condition       text,
  layers          text,

  -- AI measurement results
  pitch           numeric,
  squares         numeric,
  footprint       numeric,
  complexity      numeric,
  confidence      numeric,
  roof_type_detected text,
  material_detected  text,

  -- Signal flags
  signal_solar    boolean default false,
  signal_sv       boolean default false,
  signal_sat      boolean default false,
  signal_regrid   boolean default false,

  -- Pricing
  price_good      integer,
  price_better    integer,
  price_best      integer,
  monthly_payment integer,

  -- Results page
  results_url     text,

  -- Meta
  source          text default 'upfrog-funnel',
  ghl_pushed      boolean default false,
  ghl_pushed_at   timestamptz
);

-- ── INDEXES ───────────────────────────────────────────────────
create index if not exists leads_client_id_idx on leads(client_id);
create index if not exists leads_created_at_idx on leads(created_at desc);
create index if not exists leads_email_idx on leads(email);
create index if not exists clients_slug_idx on clients(slug);
create index if not exists clients_portal_email_idx on clients(portal_email);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table leads   enable row level security;
alter table clients enable row level security;

-- Service role (Cloudflare Worker) can do everything
create policy "service_role_all_leads"
  on leads for all
  using (true)
  with check (true);

create policy "service_role_all_clients"
  on clients for all
  using (true)
  with check (true);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at
  before update on clients
  for each row execute function update_updated_at();

-- ── RESULTS PAGE URL GENERATOR ────────────────────────────────
-- Generates a unique shareable results URL per lead
-- Format: https://refrog.app/results/{lead_id}
-- The funnel page POSTs the lead, gets back the ID, redirects to this URL

-- ── DONE ─────────────────────────────────────────────────────
-- After running this:
-- 1. Go to Settings → API → copy your service_role key
-- 2. Add it to your Cloudflare Worker as SUPABASE_SERVICE_KEY
-- 3. Add SUPABASE_URL = https://yiuqzzlatenrszwvdhui.supabase.co
