// POST /api/places
// Body: { query: string, area?: string, limit?: number }
// Returns: { source, query, count, places: [{name,area,rating,reviews,openNow,budget,...}] }
//
// Fetches real Tokyo venue data via the Google Places API (New) Text Search.
// Key comes from the GOOGLE_PLACES_API_KEY environment variable — set it as an
// encrypted var in Cloudflare → Pages → Settings → Environment variables.
// Never commit keys.

import { json, preflight, requireMethod } from './_lib.js';

// Google's enum price levels → the app's ¥ budget badge.
const PRICE = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '¥',
  PRICE_LEVEL_MODERATE: '¥¥',
  PRICE_LEVEL_EXPENSIVE: '¥¥¥',
  PRICE_LEVEL_VERY_EXPENSIVE: '¥¥¥¥',
};

export async function onRequest(context) {
  const { request, env } = context;

  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  if (!env.GOOGLE_PLACES_API_KEY) {
    return json({
      error: 'missing_key',
      message: 'GOOGLE_PLACES_API_KEY is not configured. Add it in Cloudflare → Workers & Pages → anchor → Settings → Variables and Secrets (encrypted).',
    }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const query = (body.query || '').toString().trim();
  const area = (body.area || '').toString().trim();
  const limit = Math.min(Math.max(parseInt(body.limit || 10, 10) || 10, 1), 20);
  if (!query) return json({ error: 'no_query', message: 'Provide a query, e.g. "ramen".' }, 400);

  const textQuery = area ? `${query} in ${area}, Tokyo` : `${query}, Tokyo`;

  // Field mask is required by Places API (New) — request only what we map below.
  const fieldMask = [
    'places.displayName',
    'places.formattedAddress',
    'places.rating',
    'places.userRatingCount',
    'places.location',
    'places.regularOpeningHours.weekdayDescriptions',
    'places.currentOpeningHours.openNow',
    'places.priceLevel',
    'places.primaryTypeDisplayName',
    'places.googleMapsUri',
    'places.websiteUri',
  ].join(',');

  let r;
  try {
    r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: limit,
        languageCode: 'en',
        regionCode: 'JP',
      }),
    });
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e).slice(0, 300) }, 502);
  }

  if (!r.ok) {
    const detail = await r.text();
    return json({ error: 'google_error', status: r.status, detail: detail.slice(0, 500) }, 502);
  }

  const data = await r.json();
  const places = (data.places || []).slice(0, limit).map(p => {
    const openNow = p.currentOpeningHours?.openNow;
    return {
      name: p.displayName?.text || null,
      area: area || 'Tokyo',
      rating: p.rating ?? null,
      reviews: p.userRatingCount ?? null,
      openNow: openNow === true ? 'open' : openNow === false ? 'closed' : null,
      budget: PRICE[p.priceLevel] || null,
      hours: todaysHours(p.regularOpeningHours?.weekdayDescriptions),
      coords: p.location ? `${p.location.latitude}, ${p.location.longitude}` : null,
      address: p.formattedAddress || null,
      category: p.primaryTypeDisplayName?.text || null,
      website: p.websiteUri || null,
      googleUrl: p.googleMapsUri || null,
    };
  });

  return json({ source: 'google-places', query: textQuery, count: places.length, places });
}

// weekdayDescriptions is ["Monday: 9:00 AM – 7:00 PM", ...] — surface today's line.
function todaysHours(descriptions) {
  if (!Array.isArray(descriptions) || !descriptions.length) return null;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const line = descriptions.find(d => d.startsWith(today));
  return line ? line.replace(`${today}: `, '') : null;
}
