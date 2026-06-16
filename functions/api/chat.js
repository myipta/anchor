// POST /api/chat
// Body: { messages: [{role:'user'|'assistant', content}], trip: <partial draft> }
// Returns: { model, reply, updates, ready, chips }
//
// A warm Tokyo concierge that gathers trip setup through conversation, BEFORE
// any form. It extracts arrivalDate / nights / hotel / prefs into `updates` so
// the client can pre-fill onboarding. Uses Claude Sonnet via ANTHROPIC_API_KEY.

import { json, preflight, requireMethod, extractJson } from './_lib.js';

const AREAS = ['Shinjuku','Shibuya','Harajuku','Aoyama','Ginza','Asakusa','Ueno','Roppongi','Nakameguro','Ebisu','Shimokitazawa','Daikanyama','Koenji','Yanaka'];
const PREF_IDS = ['coffee','ramen','izakaya','sushi','temples','art','vintage','nature','street','nightlife','views','slow'];

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

  const history = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  const draft = body.trip && typeof body.trip === 'object' ? body.trip : {};

  // Anthropic requires the first message to be 'user' — drop any leading greeting.
  const messages = history
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }))
    .filter(m => m.content);
  while (messages.length && messages[0].role === 'assistant') messages.shift();
  if (!messages.length) return json({ error: 'no_messages', message: 'Provide at least one user message.' }, 400);

  const MODEL = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const today = new Date().toISOString().slice(0, 10);

  const system =
`You are Anchor, a warm, concise Tokyo travel concierge helping a traveler set up a new trip through natural conversation — before any forms. Today is ${today}. The destination is always Tokyo.

Through friendly back-and-forth, learn enough to pre-fill their trip:
- arrivalDate (YYYY-MM-DD) — parse relative dates ("next month", "July 10th", "the 14th") against today's date.
- nights (integer).
- hotelName and hotelArea — hotelArea MUST be one of: ${AREAS.join(', ')}. If they name a hotel you recognize, infer its neighborhood. If they describe an area or vibe, map it to the closest one.
- prefs — interest tags they'd enjoy, each MUST be one of: ${PREF_IDS.join(', ')}. Infer generously ("love a good espresso" -> coffee; "we're into yakitori and dive bars" -> izakaya, nightlife).

Rules:
- Ask ONE short, warm question at a time. React to what they said. Never interrogate or list fields.
- Infer into trip_updates as you learn; partial is fine. Only include fields you're confident about THIS turn.
- You don't need everything. Once you have at least arrivalDate and nights, you MAY set ready=true (hotel and prefs are a bonus — keep gathering or wrap up).
- Keep replies under 40 words. Be genuinely excited about Tokyo, not saccharine.
- chips: 2-4 short tap-friendly suggested replies for the user, when helpful.

Already captured (do NOT re-ask these): ${JSON.stringify(draft)}

Output ONLY a JSON object, no prose:
{"reply":"<your message>","trip_updates":{...only fields learned this turn...},"ready":<bool>,"chips":["..."]}`;

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages }),
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
  const parsed = extractJson(text) || { reply: text, trip_updates: {}, ready: false, chips: [] };

  // Validate/clamp everything the model returned.
  const u = parsed.trip_updates || {};
  const updates = {};
  if (typeof u.arrivalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(u.arrivalDate)) updates.arrivalDate = u.arrivalDate;
  if (Number.isFinite(u.nights)) updates.nights = Math.max(1, Math.min(60, Math.round(u.nights)));
  if (typeof u.hotelName === 'string' && u.hotelName.trim()) updates.hotelName = u.hotelName.trim().slice(0, 80);
  if (typeof u.hotelArea === 'string' && AREAS.includes(u.hotelArea)) updates.hotelArea = u.hotelArea;
  if (Array.isArray(u.prefs)) updates.prefs = [...new Set(u.prefs.filter(p => PREF_IDS.includes(p)))];

  return json({
    model: MODEL,
    reply: (String(parsed.reply || '').slice(0, 600)) || 'Got it — tell me more!',
    updates,
    ready: Boolean(parsed.ready),
    chips: Array.isArray(parsed.chips) ? parsed.chips.filter(c => typeof c === 'string' && c).slice(0, 4) : [],
  });
}
