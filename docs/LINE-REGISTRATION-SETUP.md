# ตั้งค่าลงทะเบียน + อนุมัติผ่าน LINE

เมื่อพนักงานกด **ลงทะเบียน** ระบบจะแจ้งเตือนไป LINE ของหัวหน้างาน พร้อมลิงก์เลือกสิทธิ์:

| สิทธิ์ | เข้าได้ |
|--------|---------|
| **User (viewer)** | หน้า Dashboard เท่านั้น |
| **Admin** | Dashboard + ฟอร์มบันทึกข้อมูล |

---

## ขั้นที่ 1 — รัน SQL เพิ่มตาราง

1. เปิด [SQL Editor](https://supabase.com/dashboard/project/fdbudhutavcpsouszwrp/sql/new)
2. วางโค้ดจาก `docs/supabase/schema-registration.sql`
3. กด **Run**

---

## ขั้นที่ 2 — สร้าง LINE Notify Token

1. เปิด [notify-bot.line.me](https://notify-bot.line.me/)
2. Login ด้วยบัญชี LINE ของ**หัวหน้างาน**
3. กด **Generate token**
4. ตั้งชื่อ เช่น `ITH Bucket Dashboard`
5. เลือกแชทที่จะรับแจ้งเตือน (แชทตัวเอง หรือกลุ่มหัวหน้า)
6. คัดลอก **Token** เก็บไว้

---

## ขั้นที่ 3 — Deploy Edge Functions

ติดตั้ง [Supabase CLI](https://supabase.com/docs/guides/cli) แล้วรัน:

```powershell
cd "c:\Users\Varaluk_M\Downloads\Bucket Dashboard_Project"
npx supabase login
npx supabase link --project-ref fdbudhutavcpsouszwrp

npx supabase secrets set LINE_NOTIFY_TOKEN="ใส่_token_จาก_LINE_Notify"
npx supabase secrets set SITE_URL="https://kornpapat-j.github.io/Bucket-Dashboard"
npx supabase secrets set EMAIL_DOMAIN="@bucket.ith"

npx supabase functions deploy register-request --no-verify-jwt
npx supabase functions deploy process-approval --no-verify-jwt
```

> `--no-verify-jwt` จำเป็นเพราะหน้าเว็บเรียกจาก GitHub Pages โดยไม่มี JWT

---

## ขั้นที่ 4 — Push โค้ดขึ้น GitHub

```powershell
git add docs/ supabase/
git commit -m "Add registration with LINE approval workflow"
git push
```

---

## วิธีใช้งาน

### พนักงาน
1. เปิด https://kornpapat-j.github.io/Bucket-Dashboard/register.html
2. กรอกชื่อ, Username, Password
3. กด **ส่งคำขอลงทะเบียน**
4. รอหัวหน้าอนุมัติใน LINE

### หัวหน้างาน (ใน LINE)
จะได้ข้อความพร้อมลิงก์ 3 แบบ:
- **อนุมัติ User** — เห็นแค่ Dashboard
- **อนุมัติ Admin** — จัดการทุกอย่าง
- **ปฏิเสธ**

กดลิงก์ใน LINE → ระบบสร้างบัญชีให้อัตโนมัติ

### หลังอนุมัติ
พนักงาน Login ที่หน้า Login ด้วย Username + Password ที่ลงทะเบียนไว้

---

## หมายเหตุ

- Admin คนแรก (`admin@bucket.ith`) ได้สิทธิ์ admin อัตโนมัติจาก SQL
- รหัสผ่านชั่วคราวใน `registration_requests` ถูกลบหลังอนุมัติ
- ถ้ายังไม่ deploy Edge Function การลงทะเบียนจะ error — ต้องทำขั้นที่ 3 ก่อน
