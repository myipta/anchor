// Shared Tokyo place-search pipeline used by /api/search and /api/searchchat.
// Files prefixed with "_" are NOT routed by Cloudflare Pages — import-only.
//
// Pull a raw list (Apify Google Maps scraper if APIFY_TOKEN is set, else Google
// Places text search), then have DeepSeek rank it to the traveler's taste and
// write a one-line "why" per result. Every stage fails soft.

import { callDeepSeek, extractJson } from './_lib.js';

const PRICE = {
  PRICE_LEVEL_FREE: 'Free', PRICE_LEVEL_INEXPENSIVE: '¥', PRICE_LEVEL_MODERATE: '¥¥',
  PRICE_LEVEL_EXPENSIVE: '¥¥¥', PRICE_LEVEL_VERY_EXPENSIVE: '¥¥¥¥',
};

// Returns { source, count, places } on success, or { error, message, places:[] }.
export async function runSearch(env, { query, area = '', taste = {}, prefs = [], limit = 14, fast = false }) {
  const q = (query || '').toString().trim();
  if (!q) return { error: 'no_query', places: [] };
  const a = (area || '').toString().trim();
  const lim = Math.min(Math.max(parseInt(limit, 10) || 14, 1), 20);
  const t = (taste && typeof taste === 'object') ? taste : {};
  const p = Array.isArray(prefs) ? prefs.slice(0, 20) : [];

  // 1) Raw list — Apify gives richer data but its sync run is slow; `fast` skips
  // it for the Google Places text search (sub-second, and includes open-now).
  let places = [], source = null;
  if (!fast && env.APIFY_TOKEN) {
    const r = await apifyGoogleMaps(env, q, a, lim);
    if (!r.error && r.places.length) { places = r.places; source = 'apify-google-maps'; }
  }
  if (!places.length && env.GOOGLE_PLACES_API_KEY) {
    const r = await googleText(env, q, a, lim);
    places = r.places || []; source = source || 'google-places';
  }
  if (!places.length) {
    return { error: source ? 'no_results' : 'no_source', source,
      message: source ? 'No matches found.' : 'Set APIFY_TOKEN or GOOGLE_PLACES_API_KEY to search live.', places: [] };
  }

  // 2) Rank to taste + write reasons (DeepSeek). Falls back to rating order.
  if (env.DEEPSEEK_API_KEY) {
    const ranked = await rankToTaste(env, q, t, p, places);
    if (ranked && ranked.length) places = ranked;
  }
  return { source, count: places.length, places };
}

// ── Apify Google Maps scraper (sync run, returns dataset items directly) ──
async function apifyGoogleMaps(env, query, area, limit) {
  const search = area ? `${query} in ${area}, Tokyo` : `${query}, Tokyo`;
  const input = {
    searchStringsArray: [search],
    maxCrawledPlacesPerSearch: limit,
    language: 'en',
    skipClosedPlaces: false,
  };
  let r;
  try {
    r = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${encodeURIComponent(env.APIFY_TOKEN)}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  } catch (e) { return { error: 'apify_fetch', detail: String(e).slice(0, 200) }; }
  if (!r.ok) { const d = await r.text(); return { error: 'apify_error', status: r.status, detail: d.slice(0, 200) }; }
  let items; try { items = await r.json(); } catch { return { error: 'apify_parse' }; }
  const places = (Array.isArray(items) ? items : []).slice(0, limit).map(p => ({
    name: p.title || p.name || null,
    area: area || p.neighborhood || p.city || 'Tokyo',
    rating: p.totalScore ?? null,
    reviews: p.reviewsCount ?? null,
    openNow: p.permanentlyClosed ? 'closed' : (p.openingHours ? null : null),
    budget: dollarsToYen(p.price),
    category: p.categoryName || (Array.isArray(p.categories) ? p.categories[0] : null) || null,
    coords: p.location ? `${p.location.lat}, ${p.location.lng}` : null,
    googleUrl: p.url || p.googleMapsUrl || null,
    address: p.address || null,
  })).filter(p => p.name);
  return { places };
}

// ── Google Places text search fallback ──
async function googleText(env, query, area, limit) {
  const textQuery = area ? `${query} in ${area}, Tokyo` : `${query}, Tokyo`;
  const fieldMask = ['places.displayName','places.formattedAddress','places.rating','places.userRatingCount',
    'places.location','places.currentOpeningHours.openNow','places.priceLevel','places.primaryTypeDisplayName',
    'places.googleMapsUri'].join(',');
  let r;
  try {
    r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': fieldMask },
      body: JSON.stringify({ textQuery, maxResultCount: limit, languageCode: 'en', regionCode: 'JP' }),
    });
  } catch { return { places: [] }; }
  if (!r.ok) return { places: [] };
  const d = await r.json();
  const places = (d.places || []).slice(0, limit).map(p => {
    const openNow = p.currentOpeningHours?.openNow;
    return {
      name: p.displayName?.text || null, area: area || 'Tokyo', rating: p.rating ?? null, reviews: p.userRatingCount ?? null,
      openNow: openNow === true ? 'open' : openNow === false ? 'closed' : null, budget: PRICE[p.priceLevel] || null,
      category: p.primaryTypeDisplayName?.text || null, coords: p.location ? `${p.location.latitude}, ${p.location.longitude}` : null,
      googleUrl: p.googleMapsUri || null, address: p.formattedAddress || null,
    };
  }).filter(p => p.name);
  return { places };
}

// ── Look up ONE named place for live data (coords→distance, rating, price). ──
// Used by the concierge to enrich Claude's recommendations and to geocode the
// hotel. Returns enriched fields or null; fails soft.
export async function lookupPlace(env, name, area) {
  if (!env.GOOGLE_PLACES_API_KEY || !name) return null;
  const textQuery = `${name}${area ? ', ' + area : ''}, Tokyo`;
  const fieldMask = ['places.displayName','places.formattedAddress','places.rating','places.userRatingCount',
    'places.location','places.currentOpeningHours.openNow','places.priceLevel','places.primaryTypeDisplayName',
    'places.googleMapsUri'].join(',');
  let r;
  try {
    r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': fieldMask },
      body: JSON.stringify({ textQuery, maxResultCount: 1, languageCode: 'en', regionCode: 'JP' }),
    });
  } catch { return null; }
  if (!r.ok) return null;
  let d; try { d = await r.json(); } catch { return null; }
  const p = (d.places || [])[0];
  if (!p) return null;
  const openNow = p.currentOpeningHours?.openNow;
  return {
    name: p.displayName?.text || null,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    budget: PRICE[p.priceLevel] || null,
    category: p.primaryTypeDisplayName?.text || null,
    coords: p.location ? `${p.location.latitude}, ${p.location.longitude}` : null,
    googleUrl: p.googleMapsUri || null,
    address: p.formattedAddress || null,
    openNow: openNow === true ? 'open' : openNow === false ? 'closed' : null,
  };
}

// ── DeepSeek: rank the raw list to the traveler's taste, drop dislikes, add reasons ──
async function rankToTaste(env, query, taste, prefs, places) {
  const likes = (Array.isArray(taste.likes) ? taste.likes : []).join(', ') || '(none)';
  const dislikes = (Array.isArray(taste.dislikes) ? taste.dislikes : []).join(', ') || '(none)';
  const list = places.map((p, i) => `${i}. ${p.name} — ${p.category || 'place'} — rating ${p.rating ?? '?'} (${p.reviews ?? 0} reviews)`).join('\n');
  const system = `You rank Tokyo places for a traveler's search. Put the best fits first, and DROP anything matching their dislikes. Return ONLY JSON:
{"ranked":[{"i":<index from the list>,"reason":"<=14 word why it fits"}]}`;
  const user = `Search: "${query}"
Likes: ${likes}
Dislikes: ${dislikes}
Onboarding prefs: ${prefs.join(', ') || '(none)'}
Places:
${list}`;
  const out = await callDeepSeek(env, { system, user, maxTokens: 900, json: true });
  if (out.error) return null;
  const parsed = extractJson(out.text);
  if (!parsed || !Array.isArray(parsed.ranked)) return null;
  const seen = new Set(), ordered = [];
  for (const r of parsed.ranked) {
    const i = Number(r.i);
    if (places[i] && !seen.has(i)) { seen.add(i); ordered.push({ ...places[i], reason: String(r.reason || '').slice(0, 120) }); }
  }
  return ordered;
}

function dollarsToYen(price) {
  if (!price || typeof price !== 'string') return null;
  const d = (price.match(/\$/g) || []).length;
  if (d) return '¥'.repeat(Math.min(d, 4));
  const y = (price.match(/¥|円/g) || []).length;
  return y ? '¥'.repeat(Math.min(y, 4)) : null;
}
