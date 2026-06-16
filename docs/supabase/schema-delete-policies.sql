-- รันครั้งเดียวใน Supabase SQL Editor (จำเป็นสำหรับปุ่ม "ลบ" บนหน้าฟอร์ม)
-- Project → SQL Editor → New query → Run

drop policy if exists "production_delete" on production;
drop policy if exists "downtime_delete" on downtime;

create policy "production_delete"
  on production for delete
  to authenticated
  using (true);

create policy "downtime_delete"
  on downtime for delete
  to authenticated
  using (true);
