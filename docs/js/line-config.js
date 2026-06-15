// ตั้งค่า LINE Messaging API สำหรับแจ้งหัวหน้างานเมื่อมีคนลงทะเบียน
// Token ใส่ใน Supabase Edge Function Secrets (ไม่ใส่ที่นี่)
window.LINE_CONFIG = {
  registrationEnabled: true,
  siteUrl: 'https://kornpapat-j.github.io/Bucket-Dashboard',
  lineOaHint: 'หัวหน้างานต้อง Add friend บัญชี LINE Official ก่อนรับแจ้งเตือน'
};
