// POST /api/suggest
// Body: { prefs: string[], places: [{id,name,area,cat|catLabel,digest|note}] }
// Returns: { model, ranked: [{id, score, reason}] }  (best-first)
//
// Uses DeepSeek (V4 Flash) to rank candidate places for a traveler's tastes and
// write a warm, specific one-line reason each one fits THIS person. Key comes
// from DEEPSEEK_API_KEY — set it as an encrypted var in Cloudflare → Workers &
// Pages → anchor → Settings → Variables and Secrets. Never commit keys.

import { json, preflight, requireMethod, extractJson, callDeepSeek } from './_lib.js';

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

  const prefs = Array.isArray(body.prefs) ? body.prefs : [];
  const places = Array.isArray(body.places) ? body.places.slice(0, 30) : [];
  if (!places.length) return json({ error: 'no_places', message: 'Provide a non-empty places array.' }, 400);

  const system =
    'You are Anchor, a Tokyo travel companion. Given a traveler\'s stated tastes ' +
    'and a list of candidate places, rank the best matches and write a warm, ' +
    'specific one-sentence reason each place fits THIS traveler. Each reason must ' +
    'reference both the traveler\'s tastes and the place\'s character — never generic. ' +
    'Output ONLY valid JSON, no prose.';

  const userMsg = JSON.stringify({
    traveler_tastes: prefs,
    places: places.map(p => ({
      id: p.id,
      name: p.name,
      area: p.area,
      category: p.cat || p.catLabel || '',
      about: p.digest || p.note || p.reason || '',
    })),
    return_shape: '{"ranked":[{"id":"<place id>","score":0-100,"reason":"<one sentence>"}]}',
    rules: 'Order best-first. Include every place exactly once. Reasons under 24 words. Return JSON.',
  });

  const res = await callDeepSeek(env, { system, user: userMsg, maxTokens: 1024, json: true });
  if (res.error) return json({ error: res.error, status: res.status, detail: res.detail }, 502);

  const parsed = extractJson(res.text) || { ranked: [] };
  return json({ model: res.model, ranked: Array.isArray(parsed.ranked) ? parsed.ranked : [] });
}
