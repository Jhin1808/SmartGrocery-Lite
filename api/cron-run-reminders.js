// Vercel Cron -> calls your backend reminders endpoint
export default async function handler(req, res) {
  const isCron = Boolean(req.headers['x-vercel-cron']);

  // Allow manual test via Authorization: Bearer <CRON_SECRET>
  const auth = req.headers['authorization'] || '';
  const manualOk = auth.startsWith('Bearer ') && auth.slice(7) === process.env.CRON_SECRET;

  if (!isCron && !manualOk) {
    return res.status(401).send('forbidden');
  }

  try {
    const r = await fetch('https://api.smartgrocery.online/tasks/run-reminders', {
      method: 'POST',
      headers: { 'x-api-key': process.env.CRON_SECRET },
    });
    return res.status(200).json({ ok: r.ok, status: r.status });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}

