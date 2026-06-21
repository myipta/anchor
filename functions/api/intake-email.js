// POST /api/intake/email
// Body: { subject?, text, from? }
// Parses a forwarded travel confirmation and merges hotel/flights into the signed-in trip.

import { json, preflight, requireMethod } from './_lib.js';
import { requireDB, getUser, unauthorized } from './_auth.js';
import { ingestTravelEmail } from './_intake.js';

export async function onRequest({ request, env }) {
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;
  const noDb = requireDB(env); if (noDb) return noDb;
  const user = await getUser(request, env);
  if (!user) return unauthorized();

  let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const text = String(body.text || '').slice(0, 24000);
  if (!text.trim()) return json({ error: 'empty_email', message: 'Paste or forward a travel confirmation email.' }, 400);

  const result = await ingestTravelEmail(env, user, {
    subject: String(body.subject || '').slice(0, 180),
    text,
    from: body.from || user.email,
    receivedAt: Date.now(),
  });
  if (result.error) return json(result, 400);
  return json(result);
}
