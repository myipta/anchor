// POST /api/suggest
// Body: { prefs: string[], places: [{id,name,area,cat|catLabel,digest|note}] }
// Returns: { model, ranked: [{id, score, reason}] }  (best-first)
//
// Uses Claude to rank candidate places for a traveler's tastes and write a
// warm, specific one-line reason each one fits THIS person. Keys come from
// the ANTHROPIC_API_KEY environment variable — set it as an encrypted var in
// Cloudflare → Pages → Settings → Environment variables. Never commit keys.

import { json, preflight, requireMethod, extractJson } from './_lib.js';

export async function onRequest(context) {
  const { request, env } = context;

  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  if (!env.ANTHROPIC_API_KEY) {
    return json({
      error: 'missing_key',
      message: 'ANTHROPIC_API_KEY is not configured. Add it in Cloudflare → Workers & Pages → anchor → Settings → Variables and Secrets (encrypted).',
    }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const prefs = Array.isArray(body.prefs) ? body.prefs : [];
  const places = Array.isArray(body.places) ? body.places.slice(0, 30) : [];
  if (!places.length) return json({ error: 'no_places', message: 'Provide a non-empty places array.' }, 400);

  // Haiku 4.5 is fast + cheap and ideal for short reasoning. Bump to
  // claude-sonnet-4-6 via ANTHROPIC_MODEL if you want richer copy.
  const MODEL = env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

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
    rules: 'Order best-first. Include every place exactly once. Reasons under 24 words.',
  });

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
  } catch (e) {
    return json({ error: 'fetch_failed', detail: String(e).slice(0, 300) }, 502);
  }

  if (!r.ok) {
    const detail = await r.text();
    return json({ error: 'anthropic_error', status: r.status, detail: detail.slice(0, 500) }, 502);
  }

  const data = await r.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  const parsed = extractJson(text) || { ranked: [] };

  return json({ model: MODEL, ranked: Array.isArray(parsed.ranked) ? parsed.ranked : [] });
}
