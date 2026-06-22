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
  const saved = Array.isArray(body.saved) ? body.saved : [];
  const excludeNames = Array.isArray(body.excludeNames) ? body.excludeNames : [];
  const blockedNames = [...saved, ...excludeNames].map(normalizeName).filter(Boolean);
  if (Array.isArray(out.places)) out.places = out.places.filter(p => !isBlockedName(p.name, blockedNames) && !isLodgingPlace(p));
  // Soft failures (no_results / no_source) are returned as 200 with places:[].
  return json(out, 200);
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
  const foodCategory = /\b(restaurant|bar|cafe|coffee|dining|bistro|izakaya|sushi|ramen|yakitori|yakiniku|kaiseki|omakase|tempura|tonkatsu|soba|udon|bakery|dessert)\b/.test(category);
  return !foodCategory;
}
