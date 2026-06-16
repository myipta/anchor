// GET /api/auth/me  → { user:{email} } if signed in, else 401.

import { json, preflight } from './_lib.js';
import { getUser, unauthorized } from './_auth.js';

export async function onRequest({ request, env }) {
  const pf = preflight(request); if (pf) return pf;
  if (!env.DB) return json({ error: 'cloud_unconfigured' }, 503);
  const user = await getUser(request, env);
  if (!user) return unauthorized();
  return json({ user: { email: user.email } });
}
