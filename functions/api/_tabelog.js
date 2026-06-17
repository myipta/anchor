// Tabelog (Japan's authoritative restaurant site) search via the Apify
// parseforge/tabelog-scraper actor. Returns ranked restaurants with their real
// Tabelog score and the DIRECT restaurant URL (so the installed Tabelog app
// opens via universal links — no copy-paste). Fails soft: returns { error } and
// the caller falls back to Google.
//
// NOTE: actor input/output schemas vary between Tabelog scrapers. The actor id
// and search field are overridable via env, and output parsing is defensive so
// we can adapt to the live shape without code changes where possible.
//   env.APIFY_TOKEN           — required
//   env.APIFY_TABELOG_ACTOR   — default 'parseforge~tabelog-scraper'

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

function pick(o, keys) {
  for (const k of keys) { if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; }
  return null;
}

function coordsOf(it) {
  const lat = pick(it, ['latitude', 'lat']) ?? it.location?.lat ?? it.location?.latitude ?? it.geolocation?.lat;
  const lng = pick(it, ['longitude', 'lng', 'lon']) ?? it.location?.lng ?? it.location?.longitude ?? it.geolocation?.lng;
  const a = num(lat), b = num(lng);
  return (a != null && b != null) ? `${a}, ${b}` : null;
}

function mapItem(it, area) {
  const name = pick(it, ['name', 'title', 'restaurantName', 'shopName', 'storeName']);
  if (!name) return null;
  const rating = num(pick(it, ['rating', 'score', 'tabelogRating', 'totalScore', 'reviewScore']));
  const cats = pick(it, ['genre', 'genres', 'category', 'categories', 'cuisine']);
  const category = Array.isArray(cats) ? cats[0] : cats;
  return {
    name: String(name).slice(0, 90),
    area: area || pick(it, ['area', 'neighborhood', 'city', 'station']) || 'Tokyo',
    tabelogRating: rating && rating <= 5 ? rating : null,   // Tabelog scores are 0–5 (great is 3.5+)
    reviews: num(pick(it, ['reviewCount', 'reviewsCount', 'reviews', 'numReviews', 'reviewNum'])),
    budget: pick(it, ['budget', 'dinnerBudget', 'priceRange', 'price', 'lunchBudget']) || null,
    category: category ? String(category).slice(0, 40) : null,
    coords: coordsOf(it),
    tabelogUrl: pick(it, ['url', 'tabelogUrl', 'link', 'detailUrl', 'pageUrl', 'href']) || null,
    address: pick(it, ['address', 'fullAddress', 'addressLine']) || null,
  };
}

export async function tabelogSearch(env, { query, area = '', limit = 12 }) {
  if (!env.APIFY_TOKEN) return { error: 'no_token', places: [] };
  const q = (query || '').toString().trim();
  if (!q) return { error: 'no_query', places: [] };
  const actor = (env.APIFY_TABELOG_ACTOR || 'parseforge~tabelog-scraper').replace('/', '~');
  const searchTerm = area ? `${q} ${area}` : q;
  // Send a superset of common input keys; the actor uses what it recognises.
  const input = {
    search: searchTerm, query: searchTerm, queries: [searchTerm], keyword: searchTerm,
    searchStringsArray: [searchTerm], searchTerms: [searchTerm],
    city: 'tokyo', location: 'Tokyo', language: 'en',
    maxItems: limit, maxResults: limit, maxCrawledPlacesPerSearch: limit, limit,
    startUrls: [{ url: `https://tabelog.com/en/rstLst/?sw=${encodeURIComponent(searchTerm)}` }],
  };
  let r;
  try {
    r = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(env.APIFY_TOKEN)}&timeout=55`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  } catch (e) { return { error: 'apify_fetch', detail: String(e).slice(0, 200), places: [] }; }
  if (!r.ok) { const d = await r.text(); return { error: 'apify_error', status: r.status, detail: d.slice(0, 200), places: [] }; }
  let items; try { items = await r.json(); } catch { return { error: 'apify_parse', places: [] }; }
  const places = (Array.isArray(items) ? items : []).map(it => mapItem(it, area)).filter(Boolean).slice(0, limit);
  return { places, source: 'tabelog' };
}
