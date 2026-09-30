import { authorizeRelay, validEmail, validName, escapeHtml } from '../server-lib/email-security.js';

export default async function handler(req, res) {
  if (!authorizeRelay(req, res)) return;
  const { to, code, minutes = 15, name } = req.body || {};
  if (!validEmail(to) || typeof code !== 'string' || !/^\d{6,12}$/.test(code)
      || !Number.isInteger(minutes) || minutes < 1 || minutes > 60 || !validName(name)) {
    return res.status(400).json({ ok: false, error: 'invalid request' });
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(503).json({ ok: false, error: 'email service unavailable' });
  const headers = { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' };
  const from = process.env.EMAIL_FROM || 'SmartGrocery <no-reply@smartgrocery.online>';
  if (process.env.RESEND_AUDIENCE_ID) {
    try {
      await fetch('https://api.resend.com/contacts', {
        method: 'POST', headers, signal: AbortSignal.timeout(10000),
        body: JSON.stringify({ email: to, audience_id: process.env.RESEND_AUDIENCE_ID, first_name: name || undefined }),
      });
    } catch {
      // Contact sync is best-effort and must not prevent reset delivery.
    }
  }
  const html = `<p>Hello,</p><p>We received a request to reset your SmartGrocery password.</p>
    <p>Use this reset code in the app:</p><pre>${escapeHtml(code)}</pre>
    <p>This code expires in ${escapeHtml(minutes)} minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>`;
  const text = `Your SmartGrocery reset code: ${code}\nExpires in ${minutes} minutes.\nIf you did not request this, ignore this email.`;
  try {
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from, to: [to], subject: 'SmartGrocery: Your reset code', html, text }),
    });
    if (!result.ok) return res.status(502).json({ ok: false, error: 'email delivery failed' });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: 'email delivery failed' });
  }
}
