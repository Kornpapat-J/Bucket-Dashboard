-- เป้าหมายรายวัน — รันใน Supabase SQL Editor (หลัง schema-registration.sql)
-- Admin ตั้งค่าจากหน้า Dashboard ได้

create table if not exists daily_targets (
  date date primary key,
  daily_target numeric not null default 5000,
  hourly_target numeric not null default 400,
  high_cut_target numeric,
  drop_cut_target numeric,
  updated_at timestamptz default now()
);

alter table daily_targets add column if not exists high_cut_target numeric;
alter table daily_targets add column if not exists drop_cut_target numeric;

alter table daily_targets enable row level security;

drop policy if exists "targets_select" on daily_targets;
drop policy if exists "targets_insert" on daily_targets;
drop policy if exists "targets_update" on daily_targets;

create policy "targets_select" on daily_targets
  for select to authenticated using (true);

create policy "targets_insert" on daily_targets
  for insert to authenticated
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

create policy "targets_update" on daily_targets
  for update to authenticated
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));
