export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ ok: false, error: 'cron secret not configured' });
  }

  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).send('forbidden');
  }

  try {
    const r = await fetch('https://api.smartgrocery.online/tasks/run-reminders', {
      method: 'POST',
      headers: { 'x-api-key': secret },
    });
    return res.status(200).json({ ok: r.ok, status: r.status });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

