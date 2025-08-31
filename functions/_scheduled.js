// Cloudflare Pages Functions (root-level) — scheduled trigger
// If you point your Pages project at the repo root, this file enables the
// scheduled function without needing a separate subfolder. You still need to
// add a Cron trigger in Pages (if available) or use a Worker/GitHub Actions
// to invoke the backend endpoint on a schedule.

export async function scheduled(event, env, ctx) {
  try {
    const res = await fetch('https://api.smartgrocery.online/tasks/run-reminders', {
      method: 'POST',
      headers: { 'x-api-key': env.CRON_SECRET },
    });
    if (!res.ok) {
      console.error('run-reminders failed', res.status);
    }
  } catch (err) {
    console.error('run-reminders error', err);
  }
}

