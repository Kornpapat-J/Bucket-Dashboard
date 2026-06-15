-- ตารางเก็บ LINE User ID ของหัวหน้างาน (รันหลัง schema-registration.sql)
create table if not exists line_supervisors (
  line_user_id text primary key,
  display_name text default '',
  created_at timestamptz default now()
);

alter table line_supervisors enable row level security;
-- ไม่เปิด policy — เข้าถึงผ่าน Edge Function (service role) เท่านั้น
