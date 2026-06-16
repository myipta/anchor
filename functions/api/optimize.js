// POST /api/optimize
// Body: { date, hotelArea, stops:[{id,name,area,category,coords,hours,openNow}] }
// Returns: { model, ordered:[{id,time}], rationale }
//
// Orders one day's stops into an efficient, enjoyable sequence with rough times,
// around the hotel, opening hours, and time-of-day. Uses DeepSeek (V4 Flash).
// Key: DEEPSEEK_API_KEY.

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

  const stops = Array.isArray(body.stops) ? body.stops.slice(0, 12) : [];
  const hotelArea = (body.hotelArea || '').toString();
  const date = (body.date || '').toString();
  if (stops.length < 2) return json({ error: 'too_few', message: 'Need at least two stops to optimize.' }, 400);

  const system =
`You are Anchor, planning one day in Tokyo. Order the given stops into an efficient, enjoyable sequence and assign each a rough start time.
Consider, in priority order:
1. Opening hours — never schedule a place while it's closed.
2. Daypart fit — coffee/breakfast in the morning; sights, museums and markets midday; izakaya, dinner and nightlife in the evening.
3. Geography — cluster nearby stops to minimize backtracking; start and end near the hotel area (${hotelArea || 'unknown'}).
4. Pace — leave breathing room; don't overpack.
Output ONLY JSON: {"ordered":[{"id":"<stop id>","time":"<HH:MM 24-hour>"}],"rationale":"<one short sentence on the logic>"}. Include EVERY stop exactly once, best order first. Return JSON.`;

  const user = JSON.stringify({ date, hotelArea, stops });

  const res = await callDeepSeek(env, { system, user, maxTokens: 600, json: true });
  if (res.error) return json({ error: res.error, status: res.status, detail: res.detail }, 502);

  const parsed = extractJson(res.text) || {};
  const ids = new Set(stops.map(s => s.id));
  let ordered = Array.isArray(parsed.ordered) ? parsed.ordered.filter(o => o && ids.has(o.id)) : [];

  // Guarantee every stop appears exactly once — append any the model dropped.
  const seen = new Set(ordered.map(o => o.id));
  stops.forEach(s => { if (!seen.has(s.id)) ordered.push({ id: s.id, time: '' }); });
  ordered = ordered.map(o => ({ id: o.id, time: typeof o.time === 'string' ? o.time.slice(0, 5) : '' }));

  return json({
    model: res.model,
    ordered,
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 200) : '',
  });
}
