// Transactional email via Resend. Returns { sent:true } or { sent:false, error }.
// Needs RESEND_API_KEY and EMAIL_FROM (e.g. "Anchor <login@anchor.mattyip.dev>").

export async function sendLoginCode(env, to, code) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { sent: false, error: 'email_unconfigured' };
  const html = `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 6px;color:#16172A">Your Anchor sign-in code</h2>
    <p style="color:#6C6E8E;margin:0 0 18px">Enter this code to sign in. It expires in 10 minutes.</p>
    <div style="font-family:monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#5A48D6;background:#F1EEFF;border-radius:14px;padding:18px;text-align:center">${code}</div>
    <p style="color:#9092AD;font-size:12px;margin:18px 0 0">If you didn't request this, you can ignore this email.</p>
  </div>`;
  let r;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: `${code} is your Anchor sign-in code`, html }),
    });
  } catch (e) { return { sent: false, error: 'fetch_failed', detail: String(e).slice(0, 200) }; }
  if (!r.ok) { const d = await r.text(); return { sent: false, error: 'resend_error', status: r.status, detail: d.slice(0, 200) }; }
  return { sent: true };
}
