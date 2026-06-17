// POST /api/tabelog
// Body: { query, area?, taste?, prefs?, saved?:[names] }
// Returns: { places, source, tabelogError? }
//
// Grounded restaurant cards for the concierge. Tabelog (via Apify) first — real
// Tabelog scores + direct restaurant URLs that open the installed app — falling
// back to a fast Google Places search if Tabelog is unconfigured or empty.

import { json, preflight, requireMethod } from './_lib.js';
import { tabelogSearch, tabelogLookup } from './_tabelog.js';
import { runSearch, lookupPlace } from './_search.js';

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
  // Google first: it reliably respects the query (tofu kaiseki != sushi). Tabelog
  // (Apify) is only tried if Google returns nothing — until its input schema is
  // confirmed via the health probe it returns generic/popular results.
  const g = await runSearch(env, { query, area, taste, prefs, limit: 14, fast: true });
  if (g.places && g.places.length) {
    places = g.places.map(p => ({ ...p, why: p.reason || '' })); source = 'google';
  } else {
    const t = await tabelogSearch(env, { query, area, limit: 14 });
    if (t.places && t.places.length) {
      places = t.places; source = t.source || 'tabelog';
      if (env.GOOGLE_PLACES_API_KEY) {
        await Promise.all(places.slice(0, 6).filter(p => !p.coords).map(async p => {
          const info = await lookupPlace(env, p.name, p.area);
          if (info) { p.coords = p.coords || info.coords; p.openNow = p.openNow ?? info.openNow; p.googleUrl = p.googleUrl || info.googleUrl; }
        }));
      }
    } else { tabelogError = t.error; }
  }

  places = places.filter(p => !savedSet.has(String(p.name || '').toLowerCase()));
  // Currently-open first when we know it.
  places.sort((a, b) => (a.openNow === 'closed' ? 1 : 0) - (b.openNow === 'closed' ? 1 : 0));
  places = places.slice(0, 5);

  // Attach each pick's DIRECT Tabelog page URL (+ score) so tapping opens the
  // Tabelog app instead of a name search. Fails soft → keeps the search link.
  await Promise.all(places.map(async p => {
    if (p.tabelogUrl) return;
    const tl = await tabelogLookup({ name: p.name, area: p.area });
    if (tl) { p.tabelogUrl = tl.tabelogUrl; if (p.tabelogRating == null && tl.tabelogRating != null) p.tabelogRating = tl.tabelogRating; }
  }));

  return json({ places, source, tabelogError });
}
