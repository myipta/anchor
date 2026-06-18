// POST /api/auth/verify  { email, code }
// Validates the code, creates/loads the user, opens a session (httpOnly cookie).

import { json, preflight, requireMethod } from './_lib.js';
import { requireDB, ensureSchema, isAllowed, sha256, normalizeEmail, createSession, sessionCookie } from './_auth.js';

export async function onRequest({ request, env }) {
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;
  const noDb = requireDB(env); if (noDb) return noDb;
  await ensureSchema(env);

  let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const email = normalizeEmail(body.email);
  const code = String(body.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return json({ error: 'bad_input', message: 'Enter the 6-digit code.' }, 400);
  if (!isAllowed(email, env)) return json({ error: 'not_approved', message: 'This email isn’t approved yet.' }, 403);

  const row = await env.DB.prepare('SELECT rowid, code_hash, expires_at, attempts FROM login_codes WHERE email=? ORDER BY created_at DESC LIMIT 1')
    .bind(email).first();
  if (!row || row.expires_at < Date.now()) return json({ error: 'code_expired', message: 'That code expired — request a new one.' }, 400);
  if (row.attempts >= 5) return json({ error: 'too_many', message: 'Too many tries — request a new code.' }, 429);
  if (row.code_hash !== await sha256(code)) {
    await env.DB.prepare('UPDATE login_codes SET attempts=attempts+1 WHERE rowid=?').bind(row.rowid).run();
    return json({ error: 'bad_code', message: 'Incorrect code.' }, 401);
  }

  // Success — clear codes, upsert user, open session.
  await env.DB.prepare('DELETE FROM login_codes WHERE email=?').bind(email).run();
  let user = await env.DB.prepare('SELECT id, email FROM users WHERE email=?').bind(email).first();
  if (!user) {
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO users (id, email, created_at) VALUES (?,?,?)').bind(id, email, Date.now()).run();
    user = { id, email };
  }
  const { token, maxAge } = await createSession(env, user.id);
  return json({ user: { email: user.email } }, 200, { 'set-cookie': sessionCookie(request, token, maxAge) });
}
