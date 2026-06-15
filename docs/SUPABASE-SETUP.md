# ตั้งค่า Supabase — ให้ทุกเครื่องเห็นข้อมูลร่วมกันอัตโนมัติ

ใช้เมื่อต้องการให้พนักงานกรอกฟอร์มจากหลายเครื่อง แล้ว Dashboard อัปเดตทันที **ไม่ต้อง push GitHub ทุกชั่วโมง**

---

## ขั้นที่ 1 — สร้าง Supabase Project (ฟรี)

1. ไปที่ [supabase.com](https://supabase.com) → Sign up / Login
2. กด **New Project**
3. ตั้งชื่อ เช่น `bucket-dashboard`
4. ตั้งรหัสผ่าน Database → Create project (รอ 1–2 นาที)

---

## ขั้นที่ 2 — สร้างตาราง

1. ใน Supabase → **SQL Editor** → **New query**
2. คัดลอกเนื้อหาจากไฟล์ `docs/supabase/schema.sql` ทั้งหมด
3. กด **Run**

---

## ขั้นที่ 3 — คัดลอก API Keys

1. ไปที่ **Project Settings** → **API**
2. คัดลอก:
   - **Project URL** (เช่น `https://xxxxx.supabase.co`)
   - **anon public** key

---

## ขั้นที่ 4 — ใส่ค่าในโปรเจกต์

แก้ไฟล์ `docs/js/supabase-config.js`:

```javascript
window.SUPABASE_CONFIG = {
  enabled: true,
  url: 'https://xxxxx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

---

## ขั้นที่ 5 — Push ขึ้น GitHub

```powershell
cd "c:\Users\Varaluk_M\Downloads\Bucket Dashboard_Project"
git add docs/js/supabase-config.js
git commit -m "Enable Supabase cloud database"
git push
```

รอ GitHub Pages deploy 1–2 นาที

---

## ผลลัพธ์

| ก่อน (โหมดเดิม) | หลัง (Supabase) |
|----------------|-----------------|
| กรอกฟอร์ม → เก็บในเครื่องตัวเอง | กรอกฟอร์ม → เข้า Database ทันที |
| ต้องดาวน์โหลด JSON + push GitHub | ไม่ต้อง push GitHub |
| คนอื่นไม่เห็นทันที | ทุกเครื่องเห็นอัปเดตอัตโนมัติ |

หน้าฟอร์มจะแสดง **☁️ โหมด Cloud** สีเขียวเมื่อเชื่อมต่อสำเร็จ

---

## หมายเหตุ

- **records.json** ยังใช้เก็บ config (เป้าหมาย, รายชื่อ Bucket) — ไม่ต้องแก้บ่อย
- Supabase ฟรี ~500 MB — เพียงพอสำหรับข้อมูลรายชั่วโมง
- ข้อมูลตัวอย่างใน records.json จะไม่แสดงเมื่อเปิด Cloud mode (ใช้ข้อมูลจาก Database แทน)
