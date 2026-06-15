import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LINE_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') || '';
const LINE_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') || '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK');

  const body = await req.text();
  const signature = req.headers.get('x-line-signature') || '';

  if (LINE_SECRET && !(await verifySignature(body, signature, LINE_SECRET))) {
    return new Response('Invalid signature', { status: 401 });
  }

  const events = JSON.parse(body).events || [];
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  for (const event of events) {
    const userId = event.source?.userId;
    if (!userId) continue;

    if (event.type === 'follow') {
      await supabase.from('line_supervisors').upsert({
        line_user_id: userId,
        display_name: 'Supervisor',
      });
      await reply(event.replyToken,
        '✅ เชื่อมต่อ ITH Bucket Dashboard แล้ว\n\n' +
        'คุณจะได้รับแจ้งเตือนเมื่อมีคนลงทะเบียน\n' +
        `User ID: ${userId}`);
    }

    if (event.type === 'message' && event.message?.type === 'text') {
      const text = (event.message.text || '').trim().toLowerCase();
      if (text === 'id' || text === 'userid' || text === 'ลงทะเบียน') {
        await supabase.from('line_supervisors').upsert({
          line_user_id: userId,
          display_name: 'Supervisor',
        });
        await reply(event.replyToken,
          `📋 User ID ของคุณ:\n${userId}\n\n` +
          'บันทึกไว้แล้ว — จะได้รับแจ้งเตือนเมื่อมีคนลงทะเบียน');
      }
    }
  }

  return new Response('OK');
});

async function reply(replyToken: string, text: string) {
  if (!LINE_TOKEN || !replyToken) return;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  });
}

async function verifySignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hash = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return hash === signature;
}
