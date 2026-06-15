# Bucket Excavation Dashboard

Dashboard รายงานการขุดดินของ Bucket พร้อมฟอร์มให้พนักงานกรอกข้อมูล — ออกแบบคล้าย [BCM Production Dashboard](https://ithcvopt-del.github.io/Production-Seng/)

## โหมดใช้งาน

| โหมด | เหมาะกับ | วิธีรัน |
|------|----------|---------|
| **GitHub Pages** (แนะนำ) | ยังไม่มี Server | Push ขึ้น GitHub → เปิด Pages |
| Local Server | ทดสอบบนเครื่อง | `npm start` |

---

## วิธี Deploy บน GitHub Pages (ไม่ต้องมี Server)

### 1. สร้าง Repository บน GitHub
- ไปที่ [github.com/new](https://github.com/new)
- ตั้งชื่อ repo เช่น `bucket-dashboard`
- เลือก Public

### 2. Push โค้ดขึ้น GitHub

```bash
cd "c:\Users\Varaluk_M\Downloads\Bucket Dashboard_Project"
git init
git add .
git commit -m "Initial commit: Bucket Excavation Dashboard"
git branch -M main
git remote add origin https://github.com/USERNAME/bucket-dashboard.git
git push -u origin main
```

### 3. เปิด GitHub Pages

1. ไปที่ repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** → Folder: **/docs**
4. กด **Save**

รอ 1–2 นาที แล้วเปิด:

```
https://USERNAME.github.io/bucket-dashboard/
```

| หน้า | URL |
|------|-----|
| Dashboard | `https://USERNAME.github.io/bucket-dashboard/` |
| ฟอร์มบันทึก | `https://USERNAME.github.io/bucket-dashboard/form.html` |

---

## การจัดการข้อมูล (ไม่มี Server)

Dashboard อ่านข้อมูลจากไฟล์ **`docs/data/records.json`** บน GitHub

### วิธีอัปเดตข้อมูลให้ทุกคนเห็น

**วิธีที่ 1 — แก้ไฟล์บน GitHub โดยตรง**
1. เปิด `docs/data/records.json` ใน repo
2. กด ✏️ Edit
3. แก้ข้อมูล → Commit changes

**วิธีที่ 2 — ใช้ฟอร์ม + ดาวน์โหลด**
1. กรอกข้อมูลที่หน้า `form.html`
2. กด **ดาวน์โหลด records.json**
3. นำไฟล์ไปแทนที่ `docs/data/records.json` แล้ว push ขึ้น GitHub

> ข้อมูลจากฟอร์มจะบันทึกในเบราว์เซอร์ชั่วคราว (localStorage) จนกว่าจะ export แล้วอัปโหลด GitHub

---

## ทดสอบบนเครื่อง (ไม่ต้อง npm)

เปิดโฟลเดอร์ `docs` ด้วย static server:

```bash
npx serve docs
```

หรือใช้ extension **Live Server** ใน VS Code เปิด `docs/index.html`

---

## ปรับแต่งเป้าหมาย / รายชื่อ Bucket

แก้ไฟล์ `docs/data/records.json`:

```json
{
  "config": {
    "dailyTarget": 5000,
    "hourlyTarget": 400,
    "buckets": ["Bucket 1", "Bucket 2", "Bucket 3", "Bucket 4", "Bucket 5"]
  }
}
```

---

## โครงสร้างโปรเจกต์

```
docs/                  ← GitHub Pages deploy จากโฟลเดอร์นี้
  index.html           ← Dashboard
  form.html            ← ฟอร์มพนักงาน
  data/records.json    ← ข้อมูลหลัก (แก้บน GitHub ได้)
  css/
  js/
server.js              ← (optional) Local server สำหรับอนาคต
```

---

## เมื่อมี Server แล้ว

สามารถใช้ `server.js` (Express) สำหรับ API บันทึกข้อมูลแบบ Real-time แทนการแก้ JSON ด้วยมือ:

```bash
npm install
npm start
```

---

## เทคโนโลยี

- HTML / CSS / JavaScript (Vanilla)
- Chart.js
- GitHub Pages (Static hosting)
- JSON file เป็นฐานข้อมูล
