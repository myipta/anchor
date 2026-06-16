// /api/trip
//   GET → { trip:<obj|null>, updated_at }   (the signed-in user's saved trip)
//   PUT { data, updated_at? } → { ok, updated_at }   (upsert; one trip per user)

import { json, preflight } from './_lib.js';
import { requireDB, getUser, unauthorized } from './_auth.js';

export async function onRequest({ request, env }) {
  const pf = preflight(request); if (pf) return pf;
  const noDb = requireDB(env); if (noDb) return noDb;
  const user = await getUser(request, env);
  if (!user) return unauthorized();

  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT data, updated_at FROM trips WHERE user_id=?').bind(user.id).first();
    let trip = null;
    if (row) { try { trip = JSON.parse(row.data); } catch { trip = null; } }
    return json({ trip, updated_at: row?.updated_at || null });
  }

  if (request.method === 'PUT') {
    let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
    if (!body || typeof body.data !== 'object' || body.data === null) return json({ error: 'bad_data' }, 400);
    const now = Date.now();
    const dataStr = JSON.stringify(body.data);
    const existing = await env.DB.prepare('SELECT id FROM trips WHERE user_id=?').bind(user.id).first();
    if (existing) {
      await env.DB.prepare('UPDATE trips SET data=?, updated_at=? WHERE user_id=?').bind(dataStr, now, user.id).run();
    } else {
      await env.DB.prepare('INSERT INTO trips (id, user_id, data, updated_at) VALUES (?,?,?,?)')
        .bind(crypto.randomUUID(), user.id, dataStr, now).run();
    }
    return json({ ok: true, updated_at: now });
  }

  return json({ error: 'method_not_allowed', allow: 'GET,PUT' }, 405);
}
