-- Bucket Dashboard — รันใน Supabase SQL Editor
-- https://supabase.com/dashboard → Project → SQL Editor

create table if not exists production (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  shift text not null check (shift in ('day', 'night')),
  bucket_id text not null,
  operator_name text not null,
  start_time text not null,
  end_time text,
  volume_bcm numeric not null,
  location text default '',
  note text default '',
  created_at timestamptz default now()
);

create table if not exists downtime (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  shift text not null check (shift in ('day', 'night')),
  bucket_id text not null,
  start_time text not null,
  end_time text default '',
  type text not null,
  description text not null,
  ongoing boolean default false,
  created_at timestamptz default now()
);

create index if not exists production_date_idx on production (date);
create index if not exists downtime_date_idx on downtime (date);

alter table production enable row level security;
alter table downtime enable row level security;

create policy "production_select" on production for select using (true);
create policy "production_insert" on production for insert with check (true);
create policy "production_update" on production for update using (true);

create policy "downtime_select" on downtime for select using (true);
create policy "downtime_insert" on downtime for insert with check (true);
create policy "downtime_update" on downtime for update using (true);

alter publication supabase_realtime add table production;
alter publication supabase_realtime add table downtime;
