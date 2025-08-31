// Cloudflare Pages Functions: scheduled trigger
// Configure a Cron Trigger in Pages → Settings → Functions → Cron triggers
// Example cron: "0 14 * * *" (daily at 14:00 UTC)

export async function scheduled(event, env, ctx) {
  try {
    const res = await fetch('https://api.smartgrocery.online/tasks/run-reminders', {
      method: 'POST',
      headers: { 'x-api-key': env.CRON_SECRET },
    });
    if (!res.ok) {
      // Log to Cloudflare logs for visibility
      console.error('run-reminders failed', res.status);
    }
  } catch (err) {
    console.error('run-reminders error', err);
  }
}

