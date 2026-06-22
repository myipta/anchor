// POST /api/search
// Body: { query, area?, taste?:{likes,dislikes}, prefs?:string[], limit? }
// Returns: { source, count, places:[{name,area,rating,reviews,openNow,budget,category,coords,googleUrl,address,reason}] }
//
// Thin wrapper over the shared taste-ranked search pipeline in _search.js.
// Every stage fails soft.

import { json, preflight, requireMethod } from './_lib.js';
import { runSearch } from './_search.js';

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const query = (body.query || '').toString().trim();
  if (!query) return json({ error: 'no_query', places: [] }, 400);

  const out = await runSearch(env, {
    query,
    area: (body.area || '').toString().trim(),
    destination: (body.destination || 'Tokyo').toString().trim(),
    taste: (body.taste && typeof body.taste === 'object') ? body.taste : {},
    prefs: Array.isArray(body.prefs) ? body.prefs.slice(0, 20) : [],
    limit: body.limit,
  });
  // Soft failures (no_results / no_source) are returned as 200 with places:[].
  return json(out, 200);
}
