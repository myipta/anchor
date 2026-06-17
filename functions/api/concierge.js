// POST /api/concierge
// Body: { messages:[{role,content}], context:{ taste, prefs, hotelArea, nights, saved:[names] } }
// Returns: { model, reply, places:[{name,area,why}], learned:{likes,dislikes}, chips }
//
// A warm, knowledgeable Tokyo local you chat with. Claude replies conversationally
// and weaves in specific REAL place recommendations, and reports any taste it
// learned this turn so the app gets sharper the more you talk. Knowledge-based by
// design (no ratings/links) — it should feel like a friend, not a directory.
// Fails soft at every stage.

import { json, preflight, requireMethod, extractJson } from './_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'missing_key', reply: 'The concierge needs ANTHROPIC_API_KEY set on the server.', places: [], learned: { likes: [], dislikes: [] }, chips: [] }, 503);
  }

  let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const history = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  const messages = history
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }))
    .filter(m => m.content);
  while (messages.length && messages[0].role === 'assistant') messages.shift();
  if (!messages.length) return json({ error: 'no_messages', reply: 'Tell me what you’re in the mood for.', places: [], learned: { likes: [], dislikes: [] }, chips: [] }, 400);

  const ctx = (body.context && typeof body.context === 'object') ? body.context : {};
  const taste = ctx.taste || {};
  const likes = (Array.isArray(taste.likes) ? taste.likes : []).join(', ') || '(none yet)';
  const dislikes = (Array.isArray(taste.dislikes) ? taste.dislikes : []).join(', ') || '(none yet)';
  const prefs = (Array.isArray(ctx.prefs) ? ctx.prefs : []).join(', ') || '(none)';
  const saved = (Array.isArray(ctx.saved) ? ctx.saved : []).slice(0, 20).join(', ') || '(none yet)';
  const hotelArea = ctx.hotelArea || 'unknown';
  const nights = ctx.nights || '?';
  const MODEL = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  const system =
`You are Anchor — a warm, sharp Tokyo local the traveler is texting for recommendations. You are NOT a search engine or a directory. Talk like a knowledgeable friend who actually lives in Tokyo: concise, specific, a little opinionated.

What you know about this traveler:
- Loves: ${likes}
- Avoids: ${dislikes}
- Interests: ${prefs}
- Staying in: ${hotelArea} (${nights} nights)
- Already saved: ${saved}

How to respond:
- Reply conversationally in 2-5 sentences. React to what they just said AND to things they told you earlier — the more they share, the more tailored you get. No bullet lists, no star ratings, no "here are some options".
- When it fits, recommend 1-4 SPECIFIC, REAL Tokyo places you genuinely know. Favor places near ${hotelArea} or wherever they mention. For each, a one-line reason tied to THIS person's taste.
- If their message is just chatting (no rec needed), recommend nothing — just talk.
- Quietly learn: extract any new taste signals from their latest message.

Output ONLY a JSON object, no prose:
{"reply":"<your message>","places":[{"name":"<real place>","area":"<Tokyo neighborhood>","why":"<one short clause for THEM>"}],"learned":{"likes":["..."],"dislikes":["..."]},"chips":["<=3 short suggested replies"]}`;

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages }),
    });
  } catch (e) {
    return json({ error: 'fetch_failed', reply: 'I lost my connection for a second — try that again?', places: [], learned: { likes: [], dislikes: [] }, chips: [], detail: String(e).slice(0, 200) }, 502);
  }
  if (!r.ok) {
    const detail = await r.text();
    return json({ error: 'anthropic_error', status: r.status, reply: 'Something went wrong reaching me — give it a moment and try again.', places: [], learned: { likes: [], dislikes: [] }, chips: [], detail: detail.slice(0, 400) }, 502);
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
  const chips = Array.isArray(parsed.chips) ? parsed.chips.filter(c => typeof c === 'string' && c.trim()).map(c => c.slice(0, 40)).slice(0, 3) : [];

  return json({
    model: MODEL,
    reply: (String(parsed.reply || '').slice(0, 700)) || 'Tell me more about what you’re after.',
    places, learned, chips,
  });
}
