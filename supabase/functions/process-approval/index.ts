import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_DOMAIN = Deno.env.get('EMAIL_DOMAIN') || '@bucket.ith';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = req.method === 'GET'
      ? Object.fromEntries(new URL(req.url).searchParams)
      : await req.json();

    const token = String(body.token || '');
    const action = String(body.action || 'approve');
    const role = String(body.role || 'viewer');

    if (!token) return json({ error: 'ไม่พบ token' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: reqRow, error: fetchErr } = await supabase
      .from('registration_requests')
      .select('*')
      .eq('approval_token', token)
      .single();

    if (fetchErr || !reqRow) return json({ error: 'ไม่พบคำขอ หรือลิงก์หมดอายุ' }, 404);
    if (reqRow.status !== 'pending') {
      return json({
        success: false,
        status: reqRow.status,
        message: reqRow.status === 'approved'
          ? `อนุมัติแล้ว (${reqRow.assigned_role})`
          : 'ปฏิเสธคำขอนี้แล้ว',
      });
    }

    if (action === 'reject') {
      await supabase.from('registration_requests').update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        password_plain: '',
      }).eq('id', reqRow.id);

      return json({ success: true, message: 'ปฏิเสธคำขอลงทะเบียนแล้ว' });
    }

    const assignedRole = role === 'admin' ? 'admin' : 'viewer';
    const email = reqRow.username + EMAIL_DOMAIN;

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: reqRow.password_plain,
      email_confirm: true,
      user_metadata: { role: assignedRole, display_name: reqRow.display_name },
    });

    if (createErr) throw createErr;

    await supabase.from('user_profiles').insert({
      id: newUser.user.id,
      username: reqRow.username,
      display_name: reqRow.display_name,
      role: assignedRole,
    });

    await supabase.from('registration_requests').update({
      status: 'approved',
      assigned_role: assignedRole,
      processed_at: new Date().toISOString(),
      user_id: newUser.user.id,
      password_plain: '',
    }).eq('id', reqRow.id);

    const roleLabel = assignedRole === 'admin' ? 'Admin (จัดการทุกอย่าง)' : 'User (ดู Dashboard เท่านั้น)';

    return json({
      success: true,
      message: `อนุมัติ ${reqRow.display_name} (@${reqRow.username}) เป็น ${roleLabel} แล้ว`,
      username: reqRow.username,
      role: assignedRole,
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
