import { timingSafeEqual } from 'node:crypto';

export function authorizeRelay(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).end();
    return false;
  }
  const secret = (process.env.EMAIL_RELAY_SECRET || '').trim();
  const supplied = req.headers['x-api-key'];
  const expected = Buffer.from(secret);
  const provided = Buffer.from(typeof supplied === 'string' ? supplied : '');
  if (secret.length < 32 || provided.length !== expected.length || !timingSafeEqual(expected, provided)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return false;
  }
  return true;
}

export function validEmail(value) {
  return typeof value === 'string' && value.length <= 254
    && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

export function validName(value) {
  return value == null || (typeof value === 'string' && value.length <= 100 && !/[\x00-\x1f]/.test(value));
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
