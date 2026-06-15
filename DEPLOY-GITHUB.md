# แก้หน้า 404 — วิธีอัปโหลดโค้ดขึ้น GitHub

หน้า 404 เกิดเพราะ repo ยังว่าง (ยังไม่มีโค้ด) และยังไม่ได้เปิด GitHub Pages

## วิธีที่ 1 — Kornpapat-J push จากเครื่องนี้ (เร็วที่สุด)

1. ลบ GitHub login เก่า (ถ้าเคย login เป็น Varaluk-M):
   - เปิด **Credential Manager** → **Windows Credentials**
   - ลบ `git:https://github.com`

2. เปิด PowerShell แล้วรัน:

```powershell
cd "c:\Users\Varaluk_M\Downloads\Bucket Dashboard_Project"
git add .
git commit -m "Add GitHub Pages workflow" --allow-empty
git push -u origin main
```

3. Login เป็น **Kornpapat-J** เมื่อเบราว์เซอร์ถาม

4. เปิด GitHub Pages:
   - https://github.com/Kornpapat-J/Bucket-Dashboard/settings/pages
   - Source: **GitHub Actions** (หรือ Branch: main, Folder: /docs)
   - Save

5. รอ 2–5 นาที แล้วเปิด:
   - https://kornpapat-j.github.io/Bucket-Dashboard/

---

## วิธีที่ 2 — อัปโหลดผ่านเว็บ GitHub (ไม่ต้องใช้ git)

1. Login เป็น **Kornpapat-J**
2. เปิด https://github.com/Kornpapat-J/Bucket-Dashboard
3. กด **Add file** → **Upload files**
4. ลากโฟลเดอร์ทั้งหมดจาก `Bucket Dashboard_Project` ลงไป (ยกเว้น `node_modules`)
5. Commit
6. ตั้ง Pages ตามขั้นตอนข้างบน

---

## วิธีที่ 3 — เพิ่ม Varaluk-M เป็นผู้ร่วม

1. Kornpapat-J → repo → **Settings** → **Collaborators** → Add **Varaluk-M**
2. Varaluk-M ยอมรับคำเชิญ
3. รัน `git push -u origin main` จากเครื่อง Varaluk-M
