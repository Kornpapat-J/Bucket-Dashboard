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

-- ลบ policy เปิดกว้าง (ถ้ารันใหม่)
drop policy if exists "production_select" on production;
drop policy if exists "production_insert" on production;
drop policy if exists "production_update" on production;
drop policy if exists "downtime_select" on downtime;
drop policy if exists "downtime_insert" on downtime;
drop policy if exists "downtime_update" on downtime;

drop policy if exists "production_delete" on production;
drop policy if exists "downtime_delete" on downtime;

-- เฉพาะผู้ Login แล้วเท่านั้น (Supabase Auth)
create policy "production_select" on production for select to authenticated using (true);
create policy "production_insert" on production for insert to authenticated with check (true);
create policy "production_update" on production for update to authenticated using (true);
create policy "production_delete" on production for delete to authenticated using (true);

create policy "downtime_select" on downtime for select to authenticated using (true);
create policy "downtime_insert" on downtime for insert to authenticated with check (true);
create policy "downtime_update" on downtime for update to authenticated using (true);
create policy "downtime_delete" on downtime for delete to authenticated using (true);

-- Realtime (ข้ามถ้ารันแล้ว)
do $$ begin
  alter publication supabase_realtime add table production;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table downtime;
exception when duplicate_object then null;
end $$;
