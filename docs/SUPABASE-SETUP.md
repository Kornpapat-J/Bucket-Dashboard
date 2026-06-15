# ตั้งค่า Supabase — Server ออนไลน์ (ฟรี)

ใช้ **Supabase** เป็น Database กลาง — พนักงานกรอกฟอร์มจากหลายเครื่อง แล้ว Dashboard อัปเดตทันที **ไม่ต้อง push GitHub ทุกชั่วโมง**

เมื่อเปิด Supabase แล้ว ระบบ Login จะใช้ **Supabase Auth** อัตโนมัติ (ไม่ใช้ username/password ใน `auth-config.js` อีกต่อไป)

---

## ขั้นที่ 1 — สร้าง Project

1. ไปที่ [supabase.com](https://supabase.com) → Sign up / Login
2. กด **New Project**
3. ตั้งชื่อ เช่น `bucket-dashboard`
4. ตั้งรหัสผ่าน Database → **Create project** (รอ 1–2 นาที)

---

## ขั้นที่ 2 — สร้างตาราง

1. Supabase → **SQL Editor** → **New query**
2. คัดลอกเนื้อหาจาก `docs/supabase/schema.sql` ทั้งหมด
3. กด **Run**

---

## ขั้นที่ 3 — ตั้งค่า Authentication

### 3.1 ปิดยืนยันอีเมล (แนะนำสำหรับใช้งานภายใน)

1. **Authentication** → **Providers** → **Email**
2. ปิด **Confirm email** (Confirm email = OFF)
3. Save

### 3.2 ตั้ง URL ของเว็บ (สำคัญ — ต้องทำ)

1. **Authentication** → **URL Configuration**
2. **Site URL:** `https://kornpapat-j.github.io/Bucket-Dashboard/`
3. **Redirect URLs** — เพิ่ม:
   - `https://kornpapat-j.github.io/Bucket-Dashboard/**`
   - `http://localhost:3000/**` (ถ้าทดสอบบนเครื่อง)
4. Save

### 3.3 สร้างผู้ใช้ Login

1. **Authentication** → **Users** → **Add user** → **Create new user**
2. ติ๊ก **Auto Confirm User**
3. สร้าง user ตามต้องการ:

| Email ใน Supabase | Login ที่หน้าเว็บ | หมายเหตุ |
|-------------------|-------------------|----------|
| `admin@bucket.ith` | Username: `admin` | ผู้ดูแล |
| `operator@bucket.ith` | Username: `operator` | พนักงานกรอกฟอร์ม |

> ระบบเติม `@bucket.ith` ให้อัตโนมัติ (แก้ domain ได้ใน `auth-config.js` → `emailDomain`)

---

## ขั้นที่ 4 — เปิด Realtime (Dashboard อัปเดตอัตโนมัติ)

1. **Database** → **Publications** (หรือ **Replication**)
2. ตรวจว่า `supabase_realtime` มีตาราง `production` และ `downtime`
3. ถ้ายังไม่มี — รันบรรทัดท้ายของ `schema.sql` อีกครั้ง

---

## ขั้นที่ 5 — คัดลอก API Keys

1. **Project Settings** → **API**
2. คัดลอก:
   - **Project URL** (เช่น `https://xxxxx.supabase.co`)
   - **anon public** key

---

## ขั้นที่ 6 — ใส่ค่าในโปรเจกต์

แก้ไฟล์ `docs/js/supabase-config.js`:

```javascript
window.SUPABASE_CONFIG = {
  enabled: true,
  url: 'https://xxxxx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

หรือคัดลอกจาก `supabase-config.example.js` แล้วใส่ค่าจริง

---

## ขั้นที่ 7 — Push ขึ้น GitHub

```powershell
cd "c:\Users\Varaluk_M\Downloads\Bucket Dashboard_Project"
git add docs/js/supabase-config.js
git commit -m "Enable Supabase cloud database"
git push
```

รอ GitHub Pages deploy 1–2 นาที แล้วทดสอบ Login ที่  
https://kornpapat-j.github.io/Bucket-Dashboard/login.html

---

## ผลลัพธ์

| ก่อน (local) | หลัง (Supabase) |
|--------------|-----------------|
| กรอกฟอร์ม → เก็บในเครื่อง | กรอกฟอร์ม → เข้า Database ทันที |
| ต้อง push JSON ขึ้น GitHub | ไม่ต้อง push GitHub |
| คนอื่นไม่เห็นทันที | ทุกเครื่องเห็นอัปเดต Realtime |

หน้าฟอร์มจะแสดง **☁️ โหมด Cloud** เมื่อเชื่อมต่อสำเร็จ

---

## ความปลอดภัย

- ข้อมูลใน Database อ่าน/เขียนได้เฉพาะผู้ **Login แล้ว** (RLS policy `authenticated`)
- **anon key** อยู่ใน frontend ได้ — แต่ไม่มี session จะเข้าถึงข้อมูลไม่ได้
- อย่าแชร์ Password ให้บุคคลภายนอก
- รายละเอียด Login เพิ่มเติม: [AUTH-SETUP.md](./AUTH-SETUP.md)

---

## หมายเหตุ

- **records.json** ยังใช้เก็บ config (เป้าหมาย, รายชื่อ Bucket) — แก้บน GitHub เป็นครั้งคราว
- Supabase ฟree tier ~500 MB — เพียงพอสำหรับข้อมูลรายชั่วโมง
- เมื่อเปิด Cloud mode ข้อมูล production/downtime มาจาก Database ไม่ใช่ records.json
