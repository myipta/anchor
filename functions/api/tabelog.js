// POST /api/tabelog
// Body: { query, area?, taste?, prefs?, saved?:[names] }
// Returns: { places, source, tabelogError? }
//
// Grounded restaurant cards for the concierge. Tabelog (via Apify) first — real
// Tabelog scores + direct restaurant URLs that open the installed app — falling
// back to a fast Google Places search if Tabelog is unconfigured or empty.

import { json, preflight, requireMethod } from './_lib.js';
import { tabelogSearch } from './_tabelog.js';
import { runSearch } from './_search.js';

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const query = (body.query || '').toString().trim();
  if (!query) return json({ error: 'no_query', places: [] }, 400);
  const area = (body.area || '').toString().trim();
  const taste = (body.taste && typeof body.taste === 'object') ? body.taste : {};
  const prefs = Array.isArray(body.prefs) ? body.prefs : [];
  const savedSet = new Set((Array.isArray(body.saved) ? body.saved : []).map(s => String(s || '').toLowerCase()));

  let places = [], source = null, tabelogError;
  const t = await tabelogSearch(env, { query, area, limit: 14 });
  if (t.places && t.places.length) { places = t.places; source = 'tabelog'; }
  else {
    tabelogError = t.error;
    const g = await runSearch(env, { query, area, taste, prefs, limit: 14, fast: true });
    places = (g.places || []).map(p => ({ ...p, why: p.reason || '' }));
    source = places.length ? 'google' : null;
  }

  places = places.filter(p => !savedSet.has(String(p.name || '').toLowerCase()));
  // Currently-open first (Google has open-now; Tabelog usually doesn't).
  places.sort((a, b) => (a.openNow === 'closed' ? 1 : 0) - (b.openNow === 'closed' ? 1 : 0));
  places = places.slice(0, 5);

  return json({ places, source, tabelogError });
}
