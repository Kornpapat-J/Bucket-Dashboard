# ตั้งค่าลงทะเบียน + อนุมัติผ่าน LINE Messaging API (ฟรี)

> LINE Notify ปิดบริการแล้ว — ใช้ **LINE Messaging API** แทน (ฟรี ~500 ข้อความ/เดือน)

เมื่อพนักงานกด **ลงทะเบียน** หัวหน้างานจะได้รับข้อความใน LINE พร้อมปุ่มอนุมัติ:

| สิทธิ์ | เข้าได้ |
|--------|---------|
| **User (viewer)** | หน้า Dashboard เท่านั้น |
| **Admin** | Dashboard + ฟอร์มบันทึกข้อมูล |

---

## ขั้นที่ 1 — รัน SQL

รันตามลำดับใน [SQL Editor](https://supabase.com/dashboard/project/fdbudhutavcpsouszwrp/sql/new):

1. `docs/supabase/schema-registration.sql` (ถ้ายังไม่รัน)
2. `docs/supabase/schema-line.sql`

---

## ขั้นที่ 2 — สร้าง LINE Official Account (ฟรี)

1. เปิด [LINE Developers Console](https://developers.line.biz/console/)
2. Login → สร้าง **Provider** (ถ้ายังไม่มี)
3. กด **Create a new channel** → เลือก **Messaging API**
4. กรอกข้อมูล:
   - Channel name: `ITH Bucket Dashboard`
   - Category: ตามที่เหมาะสม
5. สร้างเสร็จ → เปิดแท็บ **Messaging API**

### ตั้งค่า Channel

| รายการ | ค่า |
|--------|-----|
| **Allow bot to join group chats** | ปิด (ใช้แชทส่วนตัวหัวหน้า) |
| **Webhook** | เปิด (ใช้หลัง deploy ขั้นที่ 4) |
| **Auto-reply messages** | ปิด |
| **Greeting messages** | ปิด (หรือเปิดก็ได้) |

### คัดลอกค่าสำคัญ

ในแท็บ **Messaging API** → **Channel access token** → กด **Issue** → คัดลอก Token

ในแท็บ **Basic settings** → คัดลอก **Channel secret**

---

## ขั้นที่ 3 — หัวหน้า Add Friend

1. ใน Messaging API → หา **QR code** หรือ **Bot basic ID** (`@xxx`)
2. หัวหน้างานเปิด LINE → **Add friend** บัญชี Official Account นี้
3. ส่งข้อความ `id` ในแชท → บอทจะตอบ User ID และบันทึกอัตโนมัติ

---

## ขั้นที่ 4 — Deploy Edge Functions

```powershell
cd "c:\Users\Varaluk_M\Downloads\Bucket Dashboard_Project"
npx supabase login
npx supabase link --project-ref fdbudhutavcpsouszwrp

npx supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="ใส่_Channel_Access_Token"
npx supabase secrets set LINE_CHANNEL_SECRET="ใส่_Channel_Secret"
npx supabase secrets set SITE_URL="https://kornpapat-j.github.io/Bucket-Dashboard"
npx supabase secrets set EMAIL_DOMAIN="@bucket.ith"

npx supabase functions deploy register-request --no-verify-jwt
npx supabase functions deploy process-approval --no-verify-jwt
npx supabase functions deploy line-webhook --no-verify-jwt
```

### ตั้ง Webhook URL ใน LINE

หลัง deploy แล้ว ใส่ Webhook URL:

```
https://fdbudhutavcpsouszwrp.supabase.co/functions/v1/line-webhook
```

ใน LINE Developers → Messaging API → **Webhook settings** → เปิด **Use webhook** → กด **Verify**

---

## ขั้นที่ 5 — ทดสอบ

1. หัวหน้า Add friend + ส่ง `id` ใน LINE
2. พนักงานเปิด https://kornpapat-j.github.io/Bucket-Dashboard/register.html
3. กรอกข้อมูล → ส่งคำขอ
4. หัวหน้าได้ข้อความใน LINE พร้อมปุ่ม 3 ปุ่ม
5. กดอนุมัติ → พนักงาน Login ได้

---

## ค่าใช้จ่าย

| รายการ | ราคา |
|--------|------|
| LINE Official Account | ฟรี |
| Messaging API | ฟรี ~500 ข้อความ/เดือน |
| Supabase Edge Functions | ฟรีใน tier ฟรี |

การลงทะเบียน ~1 ข้อความต่อคำขอ — ใช้งานภายในเหมืองไม่น่าเกินโควตาฟรี

---

## หมายเหตุ

- Admin คนแรก (`admin@bucket.ith`) ได้สิทธิ์ admin จาก SQL
- หัวหน้าหลายคน: ให้ Add friend บัญชี LINE Official — ระบบบันทึก User ID อัตโนมัติ
- หรือใส่ `LINE_SUPERVISOR_USER_ID` ใน Supabase secrets โดยตรง
