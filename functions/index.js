// Optional manual trigger for testing at GET /
export async function onRequestGet({ request, env }) {
  const auth = request.headers.get('authorization') || '';
  if (auth === `Bearer ${env.CRON_SECRET}`) {
    const res = await fetch('https://api.smartgrocery.online/tasks/run-reminders', {
      method: 'POST',
      headers: { 'x-api-key': env.CRON_SECRET },
    });
    return new Response(`Triggered with status ${res.status}`);
  }
  return new Response('OK');
}

