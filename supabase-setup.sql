-- ============================================================================
-- ASHA Vaccination App — Supabase setup (one-time)
-- Project: arogya-sevak (Mumbai region)
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard -> your project -> SQL Editor
--   2. Paste this entire file -> click "Run"
--   3. Done. Then create the admin user (see SETUP.md).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ASHA workers table (admin adds/removes workers from the app)
-- ----------------------------------------------------------------------------
create table if not exists public.asha_workers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  pin text not null check (char_length(pin) = 4),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Vaccination records table
-- ----------------------------------------------------------------------------
create table if not exists public.vaccine_records (
  id uuid primary key default gen_random_uuid(),
  asha_id text not null,
  asha_name text not null,
  record_type text not null check (record_type in ('CHILD', 'PREGNANT_WOMAN')),
  patient_name text not null,
  reference_date date,
  session_date date,
  vaccines text[] not null default '{}',
  remark text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_vaccine_records_asha_name
  on public.vaccine_records (asha_name);
create index if not exists idx_vaccine_records_session_date
  on public.vaccine_records (session_date);

-- ----------------------------------------------------------------------------
-- 3. Row Level Security
--
-- The app signs ASHA workers in ANONYMOUSLY (no email) and the admin in with
-- email + password. Anonymous users have NO email claim, so
-- `auth.email() is not null` is true only for the admin.
-- ----------------------------------------------------------------------------
alter table public.asha_workers enable row level security;
alter table public.vaccine_records enable row level security;

-- Workers: any signed-in user (including anonymous) can READ the list
-- (needed for the PIN login screen).
drop policy if exists "workers_read" on public.asha_workers;
create policy "workers_read"
  on public.asha_workers for select
  to authenticated
  using (true);

-- Workers: only the admin (email login) can ADD / EDIT / DELETE workers.
drop policy if exists "workers_admin_write" on public.asha_workers;
create policy "workers_admin_write"
  on public.asha_workers for all
  to authenticated
  using (auth.email() is not null)
  with check (auth.email() is not null);

-- Records: any signed-in user can read + write (workers manage only their
-- own entries through the app UI; the admin sees everything).
drop policy if exists "records_all" on public.vaccine_records;
create policy "records_all"
  on public.vaccine_records for all
  to authenticated
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- 4. Realtime (so lists update live on every phone)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'asha_workers'
  ) then
    alter publication supabase_realtime add table public.asha_workers;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'vaccine_records'
  ) then
    alter publication supabase_realtime add table public.vaccine_records;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Seed the existing 4 ASHA workers (PIN 1234 — change from the app later)
-- ----------------------------------------------------------------------------
insert into public.asha_workers (name, pin) values
  ('उज्वला विलास शेळके', '1234'),
  ('सविता पोपट शेळके', '1234'),
  ('मनीषा संतोष कासार', '1234'),
  ('शाहीन यासीन शेख', '1234')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 6. App settings (PHC / sub-center names — editable from the admin panel)
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Settings: any signed-in user can READ (needed on the login screen).
drop policy if exists "settings_read" on public.app_settings;
create policy "settings_read"
  on public.app_settings for select
  to authenticated
  using (true);

-- Settings: only the admin (email login) can WRITE.
drop policy if exists "settings_admin_write" on public.app_settings;
create policy "settings_admin_write"
  on public.app_settings for all
  to authenticated
  using (auth.email() is not null)
  with check (auth.email() is not null);

insert into public.app_settings (key, value) values
  ('phc_name', 'देहरे'),
  ('subcenter_name', 'वडगाव गुप्ता')
on conflict (key) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
