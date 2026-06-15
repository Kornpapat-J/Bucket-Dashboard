import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SITE_URL = Deno.env.get('SITE_URL') || 'https://kornpapat-j.github.io/Bucket-Dashboard';
const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') || '';
const LINE_SUPERVISOR_ID = Deno.env.get('LINE_SUPERVISOR_USER_ID') || '';
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

    const lineSent = await notifySupervisors(supabase, {
      name,
      username: user,
      createdAt: row.created_at,
      token: row.approval_token,
    });

    return json({
      success: true,
      message: lineSent
        ? 'ส่งคำขอแล้ว รอหัวหน้างานอนุมัติผ่าน LINE'
        : 'บันทึกคำขอแล้ว (ยังไม่ได้ตั้ง LINE Messaging API — ดู LINE-REGISTRATION-SETUP.md)',
    });
  } catch (e) {
    return json({ error: e.message || 'เกิดข้อผิดพลาด' }, 500);
  }
});

async function notifySupervisors(
  supabase: ReturnType<typeof createClient>,
  req: { name: string; username: string; createdAt: string; token: string }
) {
  if (!LINE_TOKEN) return false;

  const recipients: string[] = [];
  const { data: supervisors } = await supabase.from('line_supervisors').select('line_user_id');
  if (supervisors?.length) {
    recipients.push(...supervisors.map((s) => s.line_user_id));
  }
  if (LINE_SUPERVISOR_ID && !recipients.includes(LINE_SUPERVISOR_ID)) {
    recipients.push(LINE_SUPERVISOR_ID);
  }
  if (!recipients.length) return false;

  const base = `${SITE_URL}/approve.html?token=${req.token}`;
  const time = new Date(req.createdAt).toLocaleString('th-TH');

  const flex = {
    type: 'flex',
    altText: `คำขอลงทะเบียน: ${req.name}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#E87722',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '🔔 คำขอลงทะเบียนใหม่', color: '#FFFFFF', weight: 'bold', size: 'md' },
          { type: 'text', text: 'ITH Bucket Dashboard', color: '#FFFFFF', size: 'xs', margin: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: `ชื่อ: ${req.name}`, wrap: true },
          { type: 'text', text: `Username: ${req.username}`, wrap: true },
          { type: 'text', text: `เวลา: ${time}`, size: 'sm', color: '#888888', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#E87722',
            action: { type: 'uri', label: '👁 อนุมัติ User (Dashboard)', uri: `${base}&role=viewer` },
          },
          {
            type: 'button',
            style: 'primary',
            color: '#3A3F44',
            action: { type: 'uri', label: '⚙️ อนุมัติ Admin', uri: `${base}&role=admin` },
          },
          {
            type: 'button',
            style: 'secondary',
            action: { type: 'uri', label: '❌ ปฏิเสธ', uri: `${base}&action=reject` },
          },
        ],
      },
    },
  };

  let sent = false;
  for (const to of recipients) {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
      body: JSON.stringify({ to, messages: [flex] }),
    });
    if (res.ok) sent = true;
  }
  return sent;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
