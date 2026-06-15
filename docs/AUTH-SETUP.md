# คู่มือตั้งค่า Login (Username / Password)

หน้า **Dashboard** และ **ฟอร์มบันทึกข้อมูล** ต้อง Login ก่อนใช้งาน

---

## โหมดที่ 1: ยังไม่เปิด Supabase (GitHub Pages อย่างเดียว)

ใช้ไฟล์ `js/auth-config.js` — ระบบตรวจ Username + Password ในเบราว์เซอร์ (SHA-256 hash)

### ข้อมูลเริ่มต้น (เปลี่ยนทันทีหลัง deploy)

| รายการ | ค่า |
|--------|-----|
| Username | `ith` |
| Password | `ITH@2026` |

### วิธีเปลี่ยนรหัสผ่าน

1. เปิดเว็บ → กด F12 → แท็บ **Console**
2. รันคำสั่ง (แทน `รหัสผ่านใหม่` ด้วยรหัสที่ต้องการ):

```javascript
await Auth.hashPassword('รหัสผ่านใหม่')
```

3. คัดลอก hash ที่ได้ไปใส่ใน `auth-config.js` ที่ `passwordHash`
4. เปลี่ยน `username` ตามต้องการ
5. Commit และ push ขึ้น GitHub

### หมายเหตุด้านความปลอดภัย

- รหัสผ่าน **ไม่ได้เก็บเป็นข้อความตรงๆ** แต่ hash อยู่ใน source code บน GitHub — คนรู้ hash ยัง brute-force ได้
- Session เก็บใน **sessionStorage** ของเบราว์เซอร์ (หมดอายุตาม `sessionHours` ค่าเริ่มต้น 12 ชม.)
- เหมาะสำหรับ **กั้นคนทั่วไป** ไม่ใช่ระดับ enterprise

---

## โหมดที่ 2: เปิด Supabase (แนะนำเมื่อใช้งานจริง)

เมื่อตั้ง `supabase-config.js` → `enabled: true` ระบบจะใช้ **Supabase Auth** แทน simpleAuth อัตโนมัติ

### ขั้นตอน

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
2. ใส่ URL และ anon key ใน `js/supabase-config.js`
3. รัน SQL จาก `supabase/schema.sql` (RLS อนุญาตเฉพาะ role `authenticated`)
4. ใน Supabase → **Authentication → Users → Add user**
   - Email: `username@bucket.ith` (เช่น `admin@bucket.ith`, `operator@bucket.ith`)
   - Password: ตั้งรหัสที่ต้องการ
5. ผู้ใช้ Login ด้วย **Username** เท่านั้น (ระบบเติม `@bucket.ith` ให้อัตโนมัติ)

### เปลี่ยน domain อีเมล

แก้ `emailDomain` ใน `auth-config.js` (ค่าเริ่มต้น `@bucket.ith`)

---

## ปุ่มออกจากระบบ

มีปุ่ม **🚪 ออกจากระบบ** ที่มุมขวาบนของ Dashboard และหน้าฟอร์ม

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|------|---------|
| `login.html` | หน้า Login |
| `js/auth-config.js` | Username, password hash, session |
| `js/auth.js` | Logic login / logout / ตรวจ session |
| `supabase/schema.sql` | RLS สำหรับ authenticated only |
