export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.EMAIL_TEST_SECRET || process.env.CRON_SECRET || '';
  if (!secret || req.headers['x-api-key'] !== secret) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const body = req.body || {};
  const to = body.to;
  const code = body.code;
  const minutes = Number(body.minutes || 15);
  const from = body.from || process.env.EMAIL_FROM || 'SmartGrocery <no-reply@smartgrocery.online>';
  const name = body.name || '';

  if (!to || !code) return res.status(400).json({ ok: false, error: 'missing to/code' });

  // Optionally ensure contact in Audience first
  try {
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (audienceId) {
      const up = await fetch('https://api.resend.com/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: to, audience_id: audienceId, first_name: name || undefined }),
      });
      if (!(up.status === 200 || up.status === 201 || up.status === 409)) {
        const body = await up.clone().json().catch(async () => ({ text: await up.text() }));
        console.error('Resend upsert failed', up.status, body);
      }
    }
  } catch (e) {
    console.error('Resend upsert error', e);
  }

  const html = `
    <p>Hello,</p>
    <p>We received a request to reset your SmartGrocery password.</p>
    <p>Use this reset code in the app:</p>
    <pre style="background:#f6f8fa;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;">${code}</pre>
    <p>This code expires in ${minutes} minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  const text = (
    `Hello,\n\n` +
    `We received a request to reset your SmartGrocery password.\n` +
    `Reset code: ${code}\n` +
    `This code expires in ${minutes} minutes.\n` +
    `If you did not request this, you can ignore this email.\n`
  );

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject: 'SmartGrocery: Your reset code', html, text }),
    });
    const body = await r.clone().json().catch(async () => ({ text: await r.text() }));
    if (!r.ok) return res.status(r.status).json({ ok: false, body });
    return res.status(200).json({ ok: true, body });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

