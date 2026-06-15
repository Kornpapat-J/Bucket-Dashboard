/* global SUPABASE_CONFIG, LINE_CONFIG */

function getFunctionsUrl(fn) {
  const base = (SUPABASE_CONFIG && SUPABASE_CONFIG.url) || '';
  return base.replace(/\/$/, '') + '/functions/v1/' + fn;
}

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('registerForm');
  if (!form) return;

  if (!SUPABASE_CONFIG?.enabled || !SUPABASE_CONFIG?.url?.includes('supabase.co')) {
    showErr('ระบบลงทะเบียนต้องเปิด Supabase ก่อน — ติดต่อผู้ดูแลระบบ');
    form.querySelector('button').disabled = true;
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('registerError');
    const okEl = document.getElementById('registerSuccess');
    const btn = form.querySelector('button[type=submit]');
    errEl.textContent = '';
    okEl.textContent = '';

    const displayName = form.displayName.value.trim();
    const username = form.username.value.trim().toLowerCase();
    const password = form.password.value;
    const password2 = form.password2.value;

    if (password !== password2) {
      showErr('รหัสผ่านไม่ตรงกัน');
      return;
    }

    btn.disabled = true;
    try {
      const res = await fetch(getFunctionsUrl('register-request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_CONFIG.anonKey,
        },
        body: JSON.stringify({ username, displayName, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ส่งคำขอไม่สำเร็จ');

      okEl.textContent = data.message || 'ส่งคำขอแล้ว รอหัวหน้างานอนุมัติผ่าน LINE';
      form.reset();
    } catch (err) {
      showErr(err.message);
      btn.disabled = false;
    }
  });

  function showErr(msg) {
    document.getElementById('registerError').textContent = msg;
  }
});
