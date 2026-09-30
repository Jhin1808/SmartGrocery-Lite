import { authorizeRelay, validEmail, validName } from '../server-lib/email-security.js';

export default async function handler(req, res) {
  if (!authorizeRelay(req, res)) return;
  const { email, name } = req.body || {};
  if (!validEmail(email) || !validName(name)) {
    return res.status(400).json({ ok: false, error: 'invalid request' });
  }
  const resendKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!resendKey || !audienceId) return res.status(503).json({ ok: false, error: 'email service unavailable' });
  try {
    const result = await fetch('https://api.resend.com/contacts', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, audience_id: audienceId, first_name: name || undefined }),
    });
    if (![200, 201, 409].includes(result.status)) return res.status(502).json({ ok: false, error: 'contact operation failed' });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: 'contact operation failed' });
  }
}
