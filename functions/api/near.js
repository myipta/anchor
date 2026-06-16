// POST /api/near
// Body: { lat: number, lng: number, radius?: number, type?: 'all'|'food'|'coffee', limit?: number }
// Returns: { source, count, center, places: [{name,rating,reviews,openNow,budget,coords,...}] }
//
// Real "near me now" via the Google Places API (New) Nearby Search.
// Ranks by distance from the caller's live coordinates. Key comes from the
// GOOGLE_PLACES_API_KEY environment variable (encrypted Cloudflare var).

import { json, preflight, requireMethod } from './_lib.js';

const PRICE = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '¥',
  PRICE_LEVEL_MODERATE: '¥¥',
  PRICE_LEVEL_EXPENSIVE: '¥¥¥',
  PRICE_LEVEL_VERY_EXPENSIVE: '¥¥¥¥',
};

// App filter → Google place types.
const TYPES = {
  food: ['restaurant'],
  coffee: ['cafe', 'coffee_shop'],
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

  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: 'no_location', message: 'Provide numeric lat and lng.' }, 400);
  }
  const radius = Math.min(Math.max(Number(body.radius) || 1200, 100), 5000);
  const limit = Math.min(Math.max(parseInt(body.limit || 16, 10) || 16, 1), 20);
  const includedTypes = TYPES[body.type] || undefined;
  const q = (body.q || '').toString().trim(); // optional text query (e.g. "natural wine") biased to the caller's location

  const fieldMask = [
    'places.displayName',
    'places.formattedAddress',
    'places.shortFormattedAddress',
    'places.rating',
    'places.userRatingCount',
    'places.location',
    'places.regularOpeningHours.weekdayDescriptions',
    'places.currentOpeningHours.openNow',
    'places.priceLevel',
    'places.primaryTypeDisplayName',
    'places.googleMapsUri',
  ].join(',');

  // A text query ("natural wine near me") uses searchText biased to the location;
  // otherwise a plain distance-ranked nearby search.
  const endpoint = q ? 'places:searchText' : 'places:searchNearby';
  const reqBody = q
    ? {
        textQuery: q,
        maxResultCount: limit,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } },
        languageCode: 'en',
        regionCode: 'JP',
      }
    : {
        maxResultCount: limit,
        rankPreference: 'DISTANCE',
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
        languageCode: 'en',
        regionCode: 'JP',
      };
  if (!q && includedTypes) reqBody.includedTypes = includedTypes;

  let r;
  try {
    r = await fetch(`https://places.googleapis.com/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e).slice(0, 300) }, 502);
  }

  if (!r.ok) {
    const detail = await r.text();
    return json({ error: 'google_error', status: r.status, detail: detail.slice(0, 500) }, 502);
  }

  const data = await r.json();
  const places = (data.places || []).map(p => {
    const openNow = p.currentOpeningHours?.openNow;
    const plat = p.location?.latitude, plng = p.location?.longitude;
    const meters = (plat != null && plng != null) ? haversine(lat, lng, plat, plng) : null;
    return {
      name: p.displayName?.text || null,
      area: shortArea(p.shortFormattedAddress) || 'Tokyo',
      rating: p.rating ?? null,
      reviews: p.userRatingCount ?? null,
      openNow: openNow === true ? 'open' : openNow === false ? 'closed' : null,
      budget: PRICE[p.priceLevel] || null,
      hours: todaysHours(p.regularOpeningHours?.weekdayDescriptions),
      coords: (plat != null && plng != null) ? `${plat}, ${plng}` : null,
      lat: plat ?? null,
      lng: plng ?? null,
      meters,
      address: p.formattedAddress || null,
      category: p.primaryTypeDisplayName?.text || null,
      googleUrl: p.googleMapsUri || null,
    };
  }).sort((a, b) => (a.meters ?? 1e9) - (b.meters ?? 1e9));

  return json({ source: 'google-places', count: places.length, center: { lat, lng }, places });
}

// Metres between two lat/lng points.
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// "1-2-3 Jingumae, Shibuya City" → "Shibuya City" style short label.
function shortArea(short) {
  if (!short) return null;
  const parts = short.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1].replace(/ City$/, '') : null;
}

function todaysHours(descriptions) {
  if (!Array.isArray(descriptions) || !descriptions.length) return null;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const line = descriptions.find(d => d.startsWith(today));
  return line ? line.replace(`${today}: `, '') : null;
}
