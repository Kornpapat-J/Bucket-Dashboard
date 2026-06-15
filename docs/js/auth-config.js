// ตั้งค่า Login
// ── โหมด Supabase (เมื่อ supabase-config.js → enabled: true) ──
//   สร้าง user ใน Supabase → Authentication → Users
//   Email: username@bucket.ith  |  Login ด้วย Username เท่านั้น
// ── โหมดทดสอบ (Supabase ยังปิด) ──
//   ใช้ username/password ด้านล่าง (เปลี่ยน hash ก่อน deploy จริง)
//   สร้าง hash: เปิด Console → await Auth.hashPassword('รหัสผ่านใหม่')
window.AUTH_CONFIG = {
  simpleAuth: {
    enabled: true,
    username: 'ith',
    // รหัสเริ่มต้น: ITH@2026 — ใช้เฉพาะตอนยังไม่เปิด Supabase
    passwordHash: 'cfd5af19079aa2f88deb65eb0186f3d13a86c8f1b630593e0f9e2c7b348a1632'
  },
  emailDomain: '@bucket.ith',
  sessionHours: 12
};
