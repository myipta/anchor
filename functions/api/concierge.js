// POST /api/concierge
// Body: { messages:[{role,content}], context:{ taste, prefs, hotelArea, hotelName, arrivalDate, nights, saved:[names] } }
// Returns: { model, reply, places:[{name,area,why}], learned:{likes,dislikes}, updates, chips }
//
// A warm, knowledgeable Tokyo local you chat with — and your whole setup surface.
// Claude replies conversationally, weaves in real place recommendations, learns
// your taste, AND gathers trip setup (hotel, dates, interests) through the same
// conversation so there's no separate onboarding. Knowledge-based by design
// (no ratings/links) — it should feel like a friend, not a directory. Fails soft.

import { json, preflight, requireMethod, extractJson } from './_lib.js';

const todayStr = () => new Date().toISOString().slice(0, 10);

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'missing_key', reply: 'The concierge needs ANTHROPIC_API_KEY set on the server.', places: [], learned: { likes: [], dislikes: [] }, updates: {}, chips: [] }, 503);
  }

  let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const history = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  const messages = history
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }))
    .filter(m => m.content);
  while (messages.length && messages[0].role === 'assistant') messages.shift();
  if (!messages.length) return json({ error: 'no_messages', reply: 'Tell me what you’re in the mood for.', places: [], learned: { likes: [], dislikes: [] }, updates: {}, chips: [] }, 400);

  const ctx = (body.context && typeof body.context === 'object') ? body.context : {};
  const taste = ctx.taste || {};
  const likes = (Array.isArray(taste.likes) ? taste.likes : []).join(', ') || '(none yet)';
  const dislikes = (Array.isArray(taste.dislikes) ? taste.dislikes : []).join(', ') || '(none yet)';
  const prefs = (Array.isArray(ctx.prefs) ? ctx.prefs : []).join(', ') || '(none)';
  const saved = (Array.isArray(ctx.saved) ? ctx.saved : []).slice(0, 20).join(', ') || '(none yet)';
  const hotelArea = (ctx.hotelArea || '').toString().trim();
  const hotelName = (ctx.hotelName || '').toString().trim();
  const arrivalDate = (ctx.arrivalDate || '').toString().trim();
  const nights = ctx.nights || 0;
  const haveStay = Boolean(hotelArea || hotelName);
  const haveDates = Boolean(arrivalDate && nights);
  const MODEL = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  const setupLine = [
    haveStay ? `staying ${hotelName ? `at ${hotelName} ` : ''}${hotelArea ? `(${hotelArea})` : ''}`.trim() : 'stay NOT known yet',
    haveDates ? `${nights} nights from ${arrivalDate}` : 'dates NOT known yet',
  ].join('; ');

  const system =
`You are Anchor — a warm, sharp Tokyo local the traveler is texting. You handle EVERYTHING through this one conversation: getting to know their trip AND recommending places. There is no separate setup form. Today is ${todayStr()}; the destination is always Tokyo.

What you know so far:
- Trip: ${setupLine}
- Loves: ${likes}
- Avoids: ${dislikes}
- Interests: ${prefs}
- Already saved: ${saved}

How to respond:
- Talk like a knowledgeable friend who lives in Tokyo: concise, specific, a little opinionated. No bullet lists, no star ratings, no "here are some options".
- SETUP, naturally: if you don't yet know their stay or dates, work ONE friendly question into your reply (never interrogate, never ask for everything at once). As you learn trip facts, put them in "updates". Parse relative dates ("next month", "the 14th") against today.
- RECOMMEND: when it fits, suggest 1-4 SPECIFIC, REAL Tokyo places you know, each with a one-line reason tied to THIS person's taste. Favor places near ${hotelArea || 'wherever they mention'}. If the message is just chatting, recommend nothing.
- LEARN: extract any new taste signals from their latest message.

Output ONLY a JSON object, no prose:
{"reply":"<your message>","places":[{"name":"<real place>","area":"<neighborhood>","why":"<one short clause for THEM>"}],"learned":{"likes":["..."],"dislikes":["..."]},"updates":{"hotelName":"<if learned>","hotelArea":"<Tokyo neighborhood if learned>","arrivalDate":"<YYYY-MM-DD if learned>","nights":<int if learned>,"prefs":["<interest tags if learned>"]},"chips":["<=3 short suggested replies"]}`;

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages }),
    });
  } catch (e) {
    return json({ error: 'fetch_failed', reply: 'I lost my connection for a second — try that again?', places: [], learned: { likes: [], dislikes: [] }, updates: {}, chips: [], detail: String(e).slice(0, 200) }, 502);
  }
  if (!r.ok) {
    const detail = await r.text();
    return json({ error: 'anthropic_error', status: r.status, reply: 'Something went wrong reaching me — give it a moment and try again.', places: [], learned: { likes: [], dislikes: [] }, updates: {}, chips: [], detail: detail.slice(0, 400) }, 502);
  }

  const data = await r.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  const parsed = extractJson(text) || { reply: text };

  const places = Array.isArray(parsed.places) ? parsed.places
    .filter(p => p && typeof p.name === 'string' && p.name.trim())
    .slice(0, 4)
    .map(p => ({ name: String(p.name).slice(0, 80), area: String(p.area || '').slice(0, 40), why: String(p.why || '').slice(0, 140) })) : [];

  const ld = parsed.learned || {};
  const clean = a => Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 40)))].slice(0, 6) : [];
  const learned = { likes: clean(ld.likes), dislikes: clean(ld.dislikes) };

  // Validate trip-setup updates (only pass through fields we're confident about).
  const u = parsed.updates || {};
  const updates = {};
  if (typeof u.hotelName === 'string' && u.hotelName.trim()) updates.hotelName = u.hotelName.trim().slice(0, 80);
  if (typeof u.hotelArea === 'string' && u.hotelArea.trim()) updates.hotelArea = u.hotelArea.trim().slice(0, 40);
  if (typeof u.arrivalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(u.arrivalDate)) updates.arrivalDate = u.arrivalDate;
  if (Number.isFinite(u.nights)) updates.nights = Math.max(1, Math.min(60, Math.round(u.nights)));
  if (Array.isArray(u.prefs)) { const p = clean(u.prefs); if (p.length) updates.prefs = p; }

  const chips = Array.isArray(parsed.chips) ? parsed.chips.filter(c => typeof c === 'string' && c.trim()).map(c => c.slice(0, 40)).slice(0, 3) : [];

  return json({
    model: MODEL,
    reply: (String(parsed.reply || '').slice(0, 700)) || 'Tell me more about what you’re after.',
    places, learned, updates, chips,
  });
}
