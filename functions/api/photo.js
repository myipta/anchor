// GET /api/photo?name=...&area=...
// Returns: { source: 'wikipedia'|'google'|null, url: string|null }
//
// Real place imagery, cheapest-first: try Wikipedia/Wikimedia (free, real
// photos for notable places), then fall back to Google Places Photos (uses
// GOOGLE_PLACES_API_KEY). Responses are cached at the edge so each place is
// looked up at most once per day.

import { json, preflight } from './_lib.js';

const UA = 'AnchorTravel/1.0 (https://anchor.mattyip.dev)';

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;

  const url = new URL(request.url);
  const name = (url.searchParams.get('name') || '').trim();
  const area = (url.searchParams.get('area') || '').trim();
  if (!name) return json({ error: 'no_name', url: null, source: null }, 400);

  // 1) Wikipedia — free, real photos for landmarks/hotels/parks.
  let photo = await wikiPhoto(name);
  let source = photo ? 'wikipedia' : null;

  // 2) Google Places Photos — accurate for nearly everything, costs money.
  if (!photo && env.GOOGLE_PLACES_API_KEY) {
    photo = await googlePhoto(env.GOOGLE_PLACES_API_KEY, name, area);
    if (photo) source = 'google';
  }

  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    // Cache hits at the edge: 1 day for a found photo, 1 hour for a miss.
    'cache-control': photo ? 'public, max-age=86400' : 'public, max-age=3600',
  };
  return new Response(JSON.stringify({ source, url: photo || null }), { headers });
}

async function wikiPhoto(name) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', prop: 'pageimages', piprop: 'thumbnail',
    pithumbsize: '800', generator: 'search', gsrsearch: `${name} Tokyo`, gsrlimit: '1',
  });
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': UA, 'Api-User-Agent': UA, accept: 'application/json' },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const pages = d?.query?.pages;
    if (!pages) return null;
    for (const k of Object.keys(pages)) {
      const src = pages[k]?.thumbnail?.source;
      if (src) return src;
    }
  } catch { /* fall through to Google */ }
  return null;
}

async function googlePhoto(key, name, area) {
  const textQuery = area ? `${name}, ${area}, Tokyo` : `${name}, Tokyo`;
  let photoName;
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.photos',
      },
      body: JSON.stringify({ textQuery, maxResultCount: 1, languageCode: 'en', regionCode: 'JP' }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    photoName = d?.places?.[0]?.photos?.[0]?.name;
  } catch { return null; }
  if (!photoName) return null;

  // skipHttpRedirect → returns JSON { photoUri } instead of a 302 to the image.
  try {
    const r = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=800&skipHttpRedirect=true`,
      { headers: { 'X-Goog-Api-Key': key } });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.photoUri || null;
  } catch { return null; }
}
