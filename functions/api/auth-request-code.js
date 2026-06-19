// POST /api/auth/request-code  { email }
// Generates a 6-digit code, stores its hash (10-min expiry), emails it.
// In dev (DEV_AUTH=1) the code is returned in the response so you can test
// without an email provider — never enable DEV_AUTH in production.

import { json, preflight, requireMethod } from './_lib.js';
import { requireDB, ensureSchema, isAllowed, sha256, randomCode, normalizeEmail, isEmail } from './_auth.js';
import { sendLoginCode } from './_email.js';

export async function onRequest({ request, env }) {
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;
  const noDb = requireDB(env); if (noDb) return noDb;
  await ensureSchema(env);

  let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) return json({ error: 'bad_email', message: 'Enter a valid email address.' }, 400);
  // Approval gate: only allowlisted emails can get a code (don't burn email/APIs).
  if (!isAllowed(email, env)) return json({ error: 'not_approved', message: 'This email isn’t approved yet. Ask the owner to add you, then try again.' }, 403);

  const code = randomCode();
  const now = Date.now();
  await env.DB.prepare('DELETE FROM login_codes WHERE email=?').bind(email).run();
  await env.DB.prepare('INSERT INTO login_codes (email, code_hash, expires_at, attempts, created_at) VALUES (?,?,?,0,?)')
    .bind(email, await sha256(code), now + 10 * 60 * 1000, now).run();

  const mail = await sendLoginCode(env, email, code);
  const out = { ok: true, sent: mail.sent };
  if (!mail.sent) {
    if (env.DEV_AUTH === '1') out.devCode = code; // dev convenience only
    out.message = mail.error === 'email_unconfigured'
      ? 'Email isn’t set up on the server.'
      : 'Couldn’t deliver the code to this address. (With Resend’s test sender, only the Resend account’s own email receives codes — verify a domain to email anyone.)';
    if (mail.detail) out.detail = mail.detail; // raw Resend reason, for debugging
  }
  return json(out);
}
