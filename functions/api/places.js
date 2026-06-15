// POST /api/places
// Body: { query: string, area?: string, limit?: number }
// Returns: { actor, query, count, places: [{name,area,rating,reviews,hours,coords,...}] }
//
// Fetches real Tokyo venue data via an Apify actor (default: the Google Maps
// scraper). Keys come from the APIFY_TOKEN environment variable — set it as an
// encrypted var in Cloudflare → Pages → Settings → Environment variables.
// Never commit keys.

import { json, preflight, requireMethod } from './_lib.js';

export async function onRequest(context) {
  const { request, env } = context;

  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  if (!env.APIFY_TOKEN) {
    return json({
      error: 'missing_key',
      message: 'APIFY_TOKEN is not configured. Add it in Cloudflare → Pages → Settings → Environment variables (encrypted).',
    }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const query = (body.query || '').toString().trim();
  const area = (body.area || '').toString().trim();
  const limit = Math.min(Math.max(parseInt(body.limit || 10, 10) || 10, 1), 30);
  if (!query) return json({ error: 'no_query', message: 'Provide a query, e.g. "ramen".' }, 400);

  // Swap actors with APIFY_ACTOR if you prefer another scraper.
  const ACTOR = env.APIFY_ACTOR || 'compass~crawler-google-places';
  const searchString = area ? `${query} in ${area}, Tokyo` : `${query}, Tokyo`;

  const input = {
    searchStringsArray: [searchString],
    maxCrawledPlacesPerSearch: limit,
    language: 'en',
    countryCode: 'jp',
  };

  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(env.APIFY_TOKEN)}`;

  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e).slice(0, 300) }, 502);
  }

  if (!r.ok) {
    const detail = await r.text();
    return json({ error: 'apify_error', status: r.status, detail: detail.slice(0, 500) }, 502);
  }

  const items = await r.json();
  const places = (Array.isArray(items) ? items : []).slice(0, limit).map(it => ({
    name: it.title || it.name || null,
    area: it.neighborhood || area || 'Tokyo',
    rating: it.totalScore ?? null,
    reviews: it.reviewsCount ?? null,
    hours: summarizeHours(it.openingHours),
    coords: it.location ? `${it.location.lat}, ${it.location.lng}` : null,
    address: it.address || null,
    category: it.categoryName || null,
    website: it.website || null,
    googleUrl: it.url || null,
  }));

  return json({ actor: ACTOR, query: searchString, count: places.length, places });
}

// Apify returns openingHours as [{day, hours}] — surface today's hours.
function summarizeHours(oh) {
  if (!Array.isArray(oh) || !oh.length) return null;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const match = oh.find(h => h.day === today);
  return (match && match.hours) || oh[0].hours || null;
}
