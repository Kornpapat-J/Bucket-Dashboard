import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = Deno.env.get('SITE_URL') || 'https://kornpapat-j.github.io/Bucket-Dashboard';
const LINE_NOTIFY_TOKEN = Deno.env.get('LINE_NOTIFY_TOKEN') || '';
const EMAIL_DOMAIN = Deno.env.get('EMAIL_DOMAIN') || '@bucket.ith';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { username, displayName, password } = await req.json();
    const user = String(username || '').trim().toLowerCase();
    const name = String(displayName || '').trim();
    const pass = String(password || '');

    if (!/^[a-z0-9_]{3,20}$/.test(user)) {
      return json({ error: 'Username ต้องเป็น a-z, 0-9, _ ความยาว 3-20 ตัว' }, 400);
    }
    if (!name || name.length < 2) return json({ error: 'กรุณากรอกชื่อ-นามสกุล' }, 400);
    if (pass.length < 6) return json({ error: 'รหัสผ่านอย่างน้อย 6 ตัว' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const email = user + EMAIL_DOMAIN;

    const { data: existingProfile } = await supabase
      .from('user_profiles').select('id').eq('username', user).maybeSingle();
    if (existingProfile) return json({ error: 'Username นี้มีในระบบแล้ว' }, 400);

    const { data: existingAuth } = await supabase.auth.admin.listUsers();
    if (existingAuth?.users?.some((u) => u.email === email)) {
      return json({ error: 'Username นี้มีในระบบแล้ว' }, 400);
    }

    const { data: pending } = await supabase
      .from('registration_requests')
      .select('id')
      .eq('username', user)
      .eq('status', 'pending')
      .maybeSingle();
    if (pending) return json({ error: 'มีคำขอลงทะเบียนรออนุมัติอยู่แล้ว' }, 400);

    const { data: row, error } = await supabase
      .from('registration_requests')
      .insert({ username: user, display_name: name, password_plain: pass })
      .select('id, approval_token, created_at')
      .single();

    if (error) throw error;

    if (LINE_NOTIFY_TOKEN) {
      const token = row.approval_token;
      const approveBase = `${SITE_URL}/approve.html?token=${token}`;
      const msg = [
        '🔔 คำขอลงทะเบียนใหม่ — ITH Bucket Dashboard',
        '',
        `ชื่อ: ${name}`,
        `Username: ${user}`,
        `เวลา: ${new Date(row.created_at).toLocaleString('th-TH')}`,
        '',
        '👁 อนุมัติ (ดู Dashboard เท่านั้น):',
        `${approveBase}&role=viewer`,
        '',
        '⚙️ อนุมัติ (Admin จัดการทุกอย่าง):',
        `${approveBase}&role=admin`,
        '',
        '❌ ปฏิเสธ:',
        `${approveBase}&action=reject`,
      ].join('\n');

      await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${LINE_NOTIFY_TOKEN}`,
        },
        body: new URLSearchParams({ message: msg }),
      });
    }

    return json({
      success: true,
      message: LINE_NOTIFY_TOKEN
        ? 'ส่งคำขอแล้ว รอหัวหน้างานอนุมัติผ่าน LINE'
        : 'บันทึกคำขอแล้ว (ยังไม่ได้ตั้ง LINE Notify — ดู LINE-REGISTRATION-SETUP.md)',
    });
  } catch (e) {
    return json({ error: e.message || 'เกิดข้อผิดพลาด' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
