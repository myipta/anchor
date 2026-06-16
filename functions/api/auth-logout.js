// POST /api/auth/logout  → clears the session + cookie.

import { json, preflight, requireMethod } from './_lib.js';
import { deleteSession, sessionCookie } from './_auth.js';

export async function onRequest({ request, env }) {
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;
  await deleteSession(request, env);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(request, '', 0) });
}
