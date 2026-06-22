// POST /api/tabelog
// Body: { query, area?, taste?, prefs?, saved?:[names] }
// Returns: { places, source, tabelogError? }
//
// Grounded restaurant cards for the concierge. Tabelog (via Apify) first — real
// Tabelog scores + direct restaurant URLs that open the installed app — falling
// back to a fast Google Places search if Tabelog is unconfigured or empty.

import { json, preflight, requireMethod } from './_lib.js';
import { tabelogSearch } from './_tabelog.js';
import { runSearch, lookupPlace } from './_search.js';

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const query = (body.query || '').toString().trim();
  if (!query) return json({ error: 'no_query', places: [] }, 400);
  const area = (body.area || '').toString().trim();
  const destination = (body.destination || 'Tokyo').toString().trim() || 'Tokyo';
  const useTabelog = isJapanSearch({ destination, area });
  const taste = (body.taste && typeof body.taste === 'object') ? body.taste : {};
  const prefs = Array.isArray(body.prefs) ? body.prefs : [];
  const saved = Array.isArray(body.saved) ? body.saved : [];
  const excludeNames = Array.isArray(body.excludeNames) ? body.excludeNames : [];
  const blockedNames = [...saved, ...excludeNames].map(normalizeName).filter(Boolean);

  let places = [], source = null, tabelogError;
  // Google first: it reliably respects the query (tofu kaiseki != sushi). Tabelog
  // (Apify) is only tried if Google returns nothing — until its input schema is
  // confirmed via the health probe it returns generic/popular results.
  const g = await runSearch(env, { query, area, destination, taste, prefs, limit: 14, fast: true });
  if (g.places && g.places.length) {
    places = g.places.map(p => ({ ...p, why: p.reason || '' })); source = 'google';
  } else if (useTabelog) {
    const t = await tabelogSearch(env, { query, area, limit: 14 });
    if (t.places && t.places.length) {
      places = t.places; source = t.source || 'tabelog';
      if (env.GOOGLE_PLACES_API_KEY) {
        await Promise.all(places.slice(0, 6).filter(p => !p.coords).map(async p => {
          const info = await lookupPlace(env, p.name, p.area, 'en', destination);
          if (info) { p.coords = p.coords || info.coords; p.openNow = p.openNow ?? info.openNow; p.googleUrl = p.googleUrl || info.googleUrl; }
        }));
      }
    } else { tabelogError = t.error; }
  }

  places = places.filter(p => !isBlockedName(p.name, blockedNames) && !isLodgingPlace(p));
  // Currently-open first when we know it.
  places.sort((a, b) => (a.openNow === 'closed' ? 1 : 0) - (b.openNow === 'closed' ? 1 : 0));
  places = places.slice(0, 5);

  // Google deep-links to the app precisely (already the card's tap). Tabelog can
  // only be a search for us (no ID/API access), so fetch each pick's LOCAL
  // Japanese name from Google and use THAT for the Tabelog search — far more
  // reliable than the English name ("Akafuda" → 赤札).
  if (useTabelog && env.GOOGLE_PLACES_API_KEY && !source?.startsWith('tabelog')) {
    await Promise.all(places.map(async p => {
      const ja = await lookupPlace(env, p.name, p.area, 'ja', destination);
      if (ja && ja.name && ja.name !== p.name) p.jaName = ja.name;
    }));
  }

  return json({ places, source, tabelogError });
}

function normalizeName(value) {
  const s = String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|hotel|tokyo|japan|jp)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || s === 'my stay' || s.length < 4) return '';
  return s;
}

function isBlockedName(name, blockedNames) {
  const n = normalizeName(name);
  return Boolean(n && blockedNames.some(b => b && (n === b || n.includes(b) || b.includes(n))));
}

function isLodgingPlace(place) {
  const category = String(place?.category || place?.catLabel || '').toLowerCase();
  const name = String(place?.name || '').toLowerCase();
  const haystack = category + ' ' + name;
  const lodging = /\b(hotel|lodging|hostel|ryokan|inn|resort|guest\s*house|capsule\s*hotel|accommodation|serviced\s*apartment)\b/.test(haystack);
  if (!lodging) return false;

  // Keep actual restaurant/bar/cafe venues if Google categorizes them that way;
  // otherwise a lodging result does not belong in restaurant recommendation cards.
  const foodCategory = /\b(restaurant|bar|cafe|coffee|dining|bistro|izakaya|sushi|ramen|yakitori|yakiniku|kaiseki|omakase|tempura|tonkatsu|soba|udon|bakery|dessert)\b/.test(category);
  return !foodCategory;
}

export function isJapanSearch({ destination = '', area = '' } = {}) {
  const hay = String(destination || '') + ' ' + String(area || '');
  if (/\b(broomfield|denver|colorado|\bco\b|united states|usa|u\.s\.|new york|seattle|san francisco|los angeles|chicago|boston|austin|portland)\b/i.test(hay)) return false;
  return /\b(tokyo|japan|kyoto|osaka|sapporo|fukuoka|kanazawa|hiroshima|nagoya|yokohama|shinjuku|shibuya|ginza|asakusa|roppongi|harajuku)\b/i.test(hay);
}
