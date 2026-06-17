// Tabelog restaurant search for the concierge — FREE direct scrape first (no
// token), optional Apify actor if APIFY_TOKEN is set, and the caller (/api/tabelog)
// falls back to Google. Returns real Tabelog scores + the DIRECT restaurant URL
// (so the installed Tabelog app opens via universal links — no copy-paste).
//
// The direct scrape reads Tabelog's JSON-LD (stable, structured) with an HTML
// regex fallback. Fails soft everywhere.

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const decode = s => String(s || '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();

function pick(o, keys) { for (const k of keys) { if (o && o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; } return null; }

// ── parse Tabelog list/search HTML ──
function parseTabelog(html, area, limit) {
  const out = [];
  const seen = new Set();
  const push = p => { if (p && p.name && p.tabelogUrl && !seen.has(p.tabelogUrl)) { seen.add(p.tabelogUrl); out.push(p); } };

  // 1) JSON-LD blocks (most reliable).
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const b of blocks) {
    const jsonText = b.replace(/^[\s\S]*?>/, '').replace(/<\/script>$/i, '').trim();
    let data; try { data = JSON.parse(jsonText); } catch { continue; }
    const stack = Array.isArray(data) ? [...data] : [data];
    while (stack.length) {
      const e = stack.shift();
      if (!e || typeof e !== 'object') continue;
      if (e['@graph']) stack.push(...[].concat(e['@graph']));
      if (e.itemListElement) stack.push(...[].concat(e.itemListElement).map(x => x && x.item ? x.item : x));
      const type = [].concat(e['@type'] || []).join(' ');
      if (/Restaurant|FoodEstablishment|LocalBusiness/i.test(type)) {
        const addr = typeof e.address === 'string' ? e.address : (e.address && (e.address.streetAddress || e.address.addressLocality)) || null;
        push({
          name: decode(e.name),
          area: area || (e.address && e.address.addressLocality) || 'Tokyo',
          tabelogRating: (() => { const r = num(e.aggregateRating && e.aggregateRating.ratingValue); return r && r <= 5 ? r : null; })(),
          reviews: num(e.aggregateRating && (e.aggregateRating.reviewCount || e.aggregateRating.ratingCount)),
          budget: e.priceRange || null,
          category: Array.isArray(e.servesCuisine) ? e.servesCuisine[0] : (e.servesCuisine || null),
          coords: (e.geo && num(e.geo.latitude) != null && num(e.geo.longitude) != null) ? `${num(e.geo.latitude)}, ${num(e.geo.longitude)}` : null,
          tabelogUrl: typeof e.url === 'string' ? e.url : null,
          address: addr ? decode(addr) : null,
        });
      }
    }
  }

  // 2) HTML fallback: restaurant name links + nearby rating.
  if (out.length < 3) {
    const re = /<a\b[^>]*href="(https:\/\/tabelog\.com\/en\/[^"]+\/\d{6,}\/)"[^>]*class="[^"]*rst-name-target[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) && out.length < limit + 5) {
      const name = decode(m[2].replace(/<[^>]+>/g, ''));
      if (name) push({ name, area: area || 'Tokyo', tabelogRating: null, reviews: null, budget: null, category: null, coords: null, tabelogUrl: m[1], address: null });
    }
    // attach ratings by document order if present
    const ratings = [...html.matchAll(/c-rating__val[^>]*>\s*([\d.]+)\s*</gi)].map(x => num(x[1])).filter(r => r && r <= 5);
    out.forEach((p, i) => { if (p.tabelogRating == null && ratings[i] != null) p.tabelogRating = ratings[i]; });
  }

  return out.slice(0, limit);
}

async function tabelogScrape({ query, area, limit }) {
  const term = area ? `${query} ${area}` : query;
  const url = `https://tabelog.com/en/rstLst/?sw=${encodeURIComponent(term)}`;
  let r;
  try {
    r = await fetch(url, { headers: {
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'accept-language': 'en-US,en;q=0.9', 'accept': 'text/html',
    } });
  } catch (e) { return { error: 'tabelog_fetch', detail: String(e).slice(0, 150), places: [] }; }
  if (!r.ok) return { error: 'tabelog_http_' + r.status, places: [] };
  let html; try { html = await r.text(); } catch { return { error: 'tabelog_body', places: [] }; }
  const places = parseTabelog(html, area, limit);
  return places.length ? { places, source: 'tabelog' } : { error: 'tabelog_parse', places: [] };
}

// ── optional Apify actor (only if APIFY_TOKEN set) ──
async function tabelogApify(env, { query, area, limit }) {
  const actor = (env.APIFY_TABELOG_ACTOR || 'parseforge~tabelog-scraper').replace('/', '~');
  const term = area ? `${query} ${area}` : query;
  // Documented path: feed Tabelog URLs directly. A keyword-search URL forces the
  // actor to honor the query (the keyword field alone was being ignored).
  const searchUrl = `https://tabelog.com/en/rstLst/?sw=${encodeURIComponent(term)}`;
  const input = {
    startUrls: [{ url: searchUrl }, { url: searchUrl, method: 'GET' }],
    urls: [searchUrl], startUrl: searchUrl, searchUrl, url: searchUrl,
    keyword: term, search: term, query: term,
    language: 'en', maxItems: limit, maxResults: limit, limit,
  };
  let r;
  try {
    r = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(env.APIFY_TOKEN)}&timeout=55`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  } catch (e) { return { error: 'apify_fetch', detail: String(e).slice(0, 150), places: [] }; }
  if (!r.ok) { const d = await r.text(); return { error: 'apify_error', status: r.status, detail: d.slice(0, 150), places: [] }; }
  let items; try { items = await r.json(); } catch { return { error: 'apify_parse', places: [] }; }
  const places = (Array.isArray(items) ? items : []).map(it => {
    const name = pick(it, ['name', 'title', 'restaurantName']); if (!name) return null;
    const rating = num(pick(it, ['rating', 'score', 'tabelogRating', 'totalScore']));
    const cats = pick(it, ['genre', 'genres', 'category', 'categories', 'cuisine']);
    return {
      name: decode(name), area: area || pick(it, ['area', 'neighborhood', 'city']) || 'Tokyo',
      tabelogRating: rating && rating <= 5 ? rating : null,
      reviews: num(pick(it, ['reviewCount', 'reviewsCount', 'reviews'])),
      budget: pick(it, ['budget', 'dinnerBudget', 'priceRange', 'price']) || null,
      category: Array.isArray(cats) ? cats[0] : cats || null,
      coords: (() => { const la = num(pick(it, ['latitude', 'lat'])), lo = num(pick(it, ['longitude', 'lng'])); return la != null && lo != null ? `${la}, ${lo}` : null; })(),
      tabelogUrl: pick(it, ['url', 'tabelogUrl', 'link', 'detailUrl']) || null,
      address: pick(it, ['address', 'fullAddress']) || null,
    };
  }).filter(Boolean).slice(0, limit);
  return places.length ? { places, source: 'tabelog-apify' } : { error: 'apify_empty', places: [] };
}

// Diagnostic: run both paths for a sample query and report what each returns,
// so /api/health?probe=1 can show why Tabelog falls back to Google.
export async function tabelogProbe(env, { query = 'ramen', area = 'Shinjuku' } = {}) {
  const s = await tabelogScrape({ query, area, limit: 5 });
  const sample = ps => (ps && ps[0]) ? { name: ps[0].name, url: ps[0].tabelogUrl, rating: ps[0].tabelogRating } : null;
  const out = { scrape: { count: (s.places || []).length, error: s.error || null, sample: sample(s.places) } };
  if (env.APIFY_TOKEN) {
    const a = await tabelogApify(env, { query, area, limit: 5 });
    out.apify = { count: (a.places || []).length, error: a.error || null, status: a.status || null, detail: a.detail || null, sample: sample(a.places) };
  } else {
    out.apify = { configured: false };
  }
  return out;
}

// Ask Apify (with the server's token) for the actor's REAL input schema +
// example input, so we can map the query to the correct field names. The token
// is never returned. Used by /api/health?actor=1.
export async function tabelogActorInfo(env) {
  if (!env.APIFY_TOKEN) return { error: 'no_token' };
  const actor = (env.APIFY_TABELOG_ACTOR || 'parseforge~tabelog-scraper').replace('/', '~');
  let r;
  try { r = await fetch(`https://api.apify.com/v2/acts/${actor}?token=${encodeURIComponent(env.APIFY_TOKEN)}`); }
  catch (e) { return { error: 'fetch_failed', detail: String(e).slice(0, 150) }; }
  if (!r.ok) { const d = await r.text(); return { error: 'http_' + r.status, detail: d.slice(0, 200) }; }
  let j; try { j = await r.json(); } catch { return { error: 'parse' }; }
  const data = j.data || {};
  let exampleInput = null;
  try { if (data.exampleRunInput && data.exampleRunInput.body) exampleInput = JSON.parse(data.exampleRunInput.body); }
  catch { exampleInput = data.exampleRunInput && data.exampleRunInput.body; }
  let inputProps = null;
  try {
    const buildId = data.taggedBuilds && data.taggedBuilds.latest && data.taggedBuilds.latest.buildId;
    if (buildId) {
      const br = await fetch(`https://api.apify.com/v2/acts/${actor}/builds/${buildId}?token=${encodeURIComponent(env.APIFY_TOKEN)}`);
      if (br.ok) {
        const bj = await br.json();
        const is = bj.data && bj.data.inputSchema;
        const schema = typeof is === 'string' ? JSON.parse(is) : is;
        if (schema && schema.properties) inputProps = Object.entries(schema.properties).map(([k, v]) => `${k}: ${(v && v.type) || '?'}${v && v.editor ? '/' + v.editor : ''}`);
      }
    }
  } catch {}
  return { name: data.name, title: data.title, exampleInput, inputProps };
}

// Look up ONE restaurant by exact name on Tabelog to get its DIRECT page URL
// (+ score) — used to deep-link Google-sourced cards into the Tabelog app
// instead of a name search. Fails soft (returns null).
export async function tabelogLookup({ name, area }) {
  if (!name) return null;
  const r = await tabelogScrape({ query: name, area, limit: 5 });
  if (!r.places || !r.places.length) return null;
  const n = String(name).toLowerCase();
  const best = r.places.find(p => p.name && (p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase()))) || r.places[0];
  return best && best.tabelogUrl ? { tabelogUrl: best.tabelogUrl, tabelogRating: best.tabelogRating } : null;
}

// With an Apify token, use the real actor (respects the query). Without one, try
// the free scrape. Either way, the caller (/api/tabelog) falls back to Google —
// which reliably honors the query — so we never get stuck on generic results.
export async function tabelogSearch(env, { query, area = '', limit = 12 }) {
  const q = (query || '').toString().trim();
  if (!q) return { error: 'no_query', places: [] };
  if (env.APIFY_TOKEN) {
    const a = await tabelogApify(env, { query: q, area, limit });
    return (a.places && a.places.length) ? a : { error: a.error || 'apify_empty', places: [] };
  }
  const s = await tabelogScrape({ query: q, area, limit });
  return (s.places && s.places.length) ? s : { error: s.error, places: [] };
}
