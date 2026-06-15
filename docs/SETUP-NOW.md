# ตั้งค่า Supabase ตอนนี้ — Project fdbudhutavcpsouszwrp

> SQL ถูกคัดลอกไป Clipboard แล้ว (รัน `scripts/setup-supabase.ps1` อีกครั้งถ้าหาย)

---

## ขั้น 1 — รัน SQL สร้างตาราง

1. เปิด [SQL Editor](https://supabase.com/dashboard/project/fdbudhutavcpsouszwrp/sql/new)
2. วาง **Ctrl+V** (โค้ดจาก `docs/supabase/schema.sql`)
3. กด **Run** → ต้องเห็น Success

---

## ขั้น 2 — ตั้ง Authentication

### ปิดยืนยันอีเมล
[Email Provider](https://supabase.com/dashboard/project/fdbudhutavcpsouszwrp/auth/providers?provider=Email) → ปิด **Confirm email** → Save

### ตั้ง URL เว็บ
[URL Configuration](https://supabase.com/dashboard/project/fdbudhutavcpsouszwrp/auth/url-configuration)

| ช่อง | ค่า |
|------|-----|
| Site URL | `https://kornpapat-j.github.io/Bucket-Dashboard/` |
| Redirect URLs | `https://kornpapat-j.github.io/Bucket-Dashboard/**` |

### สร้าง User
[Users](https://supabase.com/dashboard/project/fdbudhutavcpsouszwrp/auth/users) → **Add user** → **Create new user**

| Email | Password | ติ๊ก |
|-------|----------|------|
| `admin@bucket.ith` | ตั้งเอง (แนะนำ `ITH@2026`) | Auto Confirm User |

Login ที่เว็บด้วย Username: **`admin`**

---

## ขั้น 3 — ใส่ API Key

1. เปิด [API Settings](https://supabase.com/dashboard/project/fdbudhutavcpsouszwrp/settings/api)
2. คัดลอก **anon public** key
3. แก้ `docs/js/supabase-config.js`:

```javascript
window.SUPABASE_CONFIG = {
  enabled: true,
  url: 'https://fdbudhutavcpsouszwrp.supabase.co',
  anonKey: 'วาง anon key ตรงนี้'
};
```

---

## ขั้น 4 — Push GitHub

```powershell
cd "c:\Users\Varaluk_M\Downloads\Bucket Dashboard_Project"
git add docs/
git commit -m "Add login protection and Supabase cloud config"
git push
```
