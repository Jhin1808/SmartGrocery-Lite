export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.EMAIL_TEST_SECRET || process.env.CRON_SECRET || '';
  if (!secret || req.headers['x-api-key'] !== secret) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const { email, name } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: 'missing email' });

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId) return res.status(400).json({ ok: false, error: 'no audience configured' });

  try {
    const r = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, audience_id: audienceId, first_name: name || undefined }),
    });
    const body = await r.clone().json().catch(async () => ({ text: await r.text() }));
    if (!(r.status === 200 || r.status === 201 || r.status === 409)) {
      return res.status(r.status).json({ ok: false, body });
    }
    return res.status(200).json({ ok: true, body });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

