/* global SUPABASE_CONFIG */

function getFunctionsUrl(fn) {
  const base = (SUPABASE_CONFIG && SUPABASE_CONFIG.url) || '';
  return base.replace(/\/$/, '') + '/functions/v1/' + fn;
}

document.addEventListener('DOMContentLoaded', async () => {
  const el = document.getElementById('approveContent');
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const role = params.get('role');
  const action = params.get('action');

  if (!token) {
    el.innerHTML = '<p class="login-error">ลิงก์ไม่ถูกต้อง</p>';
    return;
  }

  if (!SUPABASE_CONFIG?.enabled) {
    el.innerHTML = '<p class="login-error">ยังไม่ได้ตั้งค่า Supabase</p>';
    return;
  }

  const payload = { token };
  if (action === 'reject') {
    payload.action = 'reject';
  } else if (role === 'admin' || role === 'viewer') {
    payload.action = 'approve';
    payload.role = role;
  } else {
    el.innerHTML = `
      <p class="login-subtitle">เลือกการอนุมัติ</p>
      <div class="approve-actions">
        <a class="btn-primary login-btn" href="?token=${token}&role=viewer">👁 User — ดู Dashboard</a>
        <a class="btn-primary login-btn approve-admin" href="?token=${token}&role=admin">⚙️ Admin — จัดการทุกอย่าง</a>
        <a class="btn-secondary login-btn" href="?token=${token}&action=reject">❌ ปฏิเสธ</a>
      </div>`;
    return;
  }

  try {
    const res = await fetch(getFunctionsUrl('process-approval'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_CONFIG.anonKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      el.innerHTML = `<p class="login-error">${data.error || 'ดำเนินการไม่สำเร็จ'}</p>`;
      return;
    }

    const isOk = data.success !== false;
    el.innerHTML = `
      <p class="${isOk ? 'login-success' : 'login-error'}">${data.message}</p>
      ${data.username ? `<p class="login-note">ผู้ใช้ <strong>${data.username}</strong> สามารถ Login ได้แล้ว</p>` : ''}`;
  } catch (err) {
    el.innerHTML = `<p class="login-error">${err.message}</p>`;
  }
});
