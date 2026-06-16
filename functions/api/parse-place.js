// POST /api/parse-place
// Body: { text }  — a messy note ("that coffee place near Yoyogi my friend likes")
//                   or a shared Google/Yelp link.
// Returns: { name, query, area, note, source }
//
// Uses DeepSeek to turn the input into a clean Google Places lookup. For links,
// the Worker first follows redirects and reads the page title / URL slug so the
// model has the real venue name even from a shortened share link.
// Key: DEEPSEEK_API_KEY.

import { json, preflight, requireMethod, extractJson, callDeepSeek } from './_lib.js';

const AREAS = ['Shinjuku','Shibuya','Harajuku','Aoyama','Ginza','Asakusa','Ueno','Roppongi','Nakameguro','Ebisu','Shimokitazawa','Daikanyama','Koenji','Yanaka'];

// Pull a venue name out of a resolved Google Maps / Yelp URL.
function nameFromUrl(finalUrl) {
  try {
    const u = new URL(finalUrl);
    if (/google\./i.test(u.hostname)) {
      const m = u.pathname.match(/\/place\/([^/@]+)/);
      if (m) return decodeURIComponent(m[1]).replace(/\+/g, ' ').trim();
    }
    if (/yelp\./i.test(u.hostname)) {
      const m = u.pathname.match(/\/biz\/([^/?]+)/);
      if (m) return m[1].replace(/-/g, ' ').replace(/\s+\w{2,}$/, '').trim(); // drop trailing city slug
    }
  } catch {}
  return '';
}

function titleFromHtml(html) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return og[1].trim();
  const t = html.match(/<title>([^<]+)<\/title>/i);
  if (t) return t[1].trim();
  return '';
}

export async function onRequest(context) {
  const { request, env } = context;

  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  if (!env.DEEPSEEK_API_KEY) {
    return json({
      error: 'missing_key',
      message: 'DEEPSEEK_API_KEY is not configured. Add it in Cloudflare → Workers & Pages → anchor → Settings → Variables and Secrets (encrypted).',
    }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const text = (body.text || '').toString().trim();
  if (text.length < 2) return json({ error: 'no_text', message: 'Paste a name, a note, or a link.' }, 400);

  const isUrl = /^https?:\/\//i.test(text);
  let pageContext = '';
  if (isUrl) {
    try {
      const r = await fetch(text, {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; AnchorBot/1.0)' },
      });
      const finalUrl = r.url || text;
      const html = (await r.text()).slice(0, 20000);
      pageContext = `final_url: ${finalUrl}\nurl_place: ${nameFromUrl(finalUrl)}\npage_title: ${titleFromHtml(html)}`;
    } catch {
      pageContext = '(could not open the link — infer from the URL text)';
    }
  }

  const system =
`You turn a traveler's messy note or a shared link into a clean place lookup for a Tokyo trip.
Output ONLY JSON: {"name":"<clean venue name or ''>","query":"<best Google Places text search, include 'Tokyo'>","area":"<one of: ${AREAS.join(', ')} — or ''>","note":"<extra context the person gave: who recommended it, what's good, etc. — or ''>"}.
Rules: Extract the actual venue. If a neighborhood is named or implied, set area to the closest match from the list. The query must be specific enough to find the exact place on Google Maps. If you truly can't identify a place, set name and query to ''. Return JSON.`;

  const user = `Traveler input:\n${text}` + (isUrl ? `\n\nFetched from the link:\n${pageContext}` : '');

  const res = await callDeepSeek(env, { system, user, maxTokens: 300, json: true });
  if (res.error) return json({ error: res.error, status: res.status, detail: res.detail }, 502);

  const p = extractJson(res.text) || {};
  const area = typeof p.area === 'string' && AREAS.includes(p.area) ? p.area : '';
  const query = (typeof p.query === 'string' ? p.query.trim() : '').slice(0, 120);
  const name = (typeof p.name === 'string' ? p.name.trim() : '').slice(0, 80);
  const note = (typeof p.note === 'string' ? p.note.trim() : '').slice(0, 200);

  return json({ model: res.model, name, query: query || name, area, note, source: isUrl ? 'url' : 'text' });
}
