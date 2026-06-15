-- ลงทะเบียน + สิทธิ์ User/Admin — รันใน Supabase SQL Editor หลัง schema.sql

-- คำขอลงทะเบียน (เข้าถึงเฉพาะ Edge Function ผ่าน service role)
create table if not exists registration_requests (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  display_name text not null,
  password_plain text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  assigned_role text check (assigned_role in ('viewer', 'admin')),
  approval_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz default now(),
  processed_at timestamptz,
  user_id uuid
);

create index if not exists reg_requests_status_idx on registration_requests (status);
create index if not exists reg_requests_token_idx on registration_requests (approval_token);

-- โปรไฟล์ผู้ใช้ + บทบาท
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  role text not null default 'viewer' check (role in ('viewer', 'admin')),
  created_at timestamptz default now()
);

alter table registration_requests enable row level security;
alter table user_profiles enable row level security;

-- ไม่เปิด policy สาธารณะ — Edge Function ใช้ service role

-- ผู้ login อ่านโปรไฟล์ตัวเองได้
drop policy if exists "profiles_select_own" on user_profiles;
create policy "profiles_select_own" on user_profiles
  for select to authenticated using (id = auth.uid());

-- อัปเดต RLS: บันทึกข้อมูลได้เฉพาะ admin
drop policy if exists "production_insert" on production;
drop policy if exists "production_update" on production;
drop policy if exists "downtime_insert" on downtime;
drop policy if exists "downtime_update" on downtime;

create policy "production_insert" on production for insert to authenticated
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

create policy "production_update" on production for update to authenticated
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

create policy "downtime_insert" on downtime for insert to authenticated
  with check (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

create policy "downtime_update" on downtime for update to authenticated
  using (exists (select 1 from user_profiles where id = auth.uid() and role = 'admin'));

-- ตั้ง admin คนแรก (ถ้ามี admin@bucket.ith อยู่แล้ว)
insert into user_profiles (id, username, display_name, role)
select id, split_part(email, '@', 1), 'Admin', 'admin'
from auth.users
where email = 'admin@bucket.ith'
on conflict (id) do update set role = 'admin';
