// POST /api/concierge
// Body: { messages:[{role,content}], context:{...}, model?:'claude'|'deepseek' }
// Returns: { model, reply, places, learned, updates, chips }
//
// A warm Tokyo-local concierge that also handles trip setup. The chosen model
// (Claude or DeepSeek) drives the conversation and names specific real places;
// each recommendation is then GROUNDED via a live Google Places lookup (coords →
// distance, rating, price, open-now) so the cards reflect reality. Fails soft.

import { json, preflight, requireMethod, extractJson, callDeepSeek } from './_lib.js';
import { lookupPlace } from './_search.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const EMPTY = { places: [], learned: { likes: [], dislikes: [] }, updates: {}, chips: [] };

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const model = body.model === 'deepseek' ? 'deepseek' : 'claude';

  if (model === 'claude' && !env.ANTHROPIC_API_KEY)
    return json({ error: 'missing_key', reply: 'Claude isn’t configured here (ANTHROPIC_API_KEY). Flip the switch to DeepSeek.', ...EMPTY }, 503);
  if (model === 'deepseek' && !env.DEEPSEEK_API_KEY)
    return json({ error: 'missing_key', reply: 'DeepSeek isn’t configured here. Flip the switch back to Claude.', ...EMPTY }, 503);

  const history = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  const messages = history
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }))
    .filter(m => m.content);
  while (messages.length && messages[0].role === 'assistant') messages.shift();
  if (!messages.length) return json({ error: 'no_messages', reply: 'Tell me what you’re in the mood for.', ...EMPTY }, 400);

  const ctx = (body.context && typeof body.context === 'object') ? body.context : {};
  const taste = ctx.taste || {};
  const likes = (Array.isArray(taste.likes) ? taste.likes : []).join(', ') || '(none yet)';
  const dislikes = (Array.isArray(taste.dislikes) ? taste.dislikes : []).join(', ') || '(none yet)';
  const prefs = (Array.isArray(ctx.prefs) ? ctx.prefs : []).join(', ') || '(none)';
  const anchoredArr = Array.isArray(ctx.anchored) ? ctx.anchored : [];
  const ideasArr = Array.isArray(ctx.ideas) ? ctx.ideas : [];
  const anchored = anchoredArr.slice(0, 25).join(', ') || '(none yet)';
  const ideas = ideasArr.slice(0, 25).join(', ') || '(none yet)';
  const hotelArea = (ctx.hotelArea || '').toString().trim();
  const hotelName = (ctx.hotelName || '').toString().trim();
  const arrivalDate = (ctx.arrivalDate || '').toString().trim();
  const hotelCoords = (ctx.hotelCoords || '').toString().trim();
  const nights = ctx.nights || 0;
  const haveStay = Boolean(hotelArea || hotelName);
  const haveDates = Boolean(arrivalDate && nights);
  const setupLine = [
    haveStay ? `staying ${hotelName ? `at ${hotelName} ` : ''}${hotelArea ? `(${hotelArea})` : ''}`.trim() : 'stay NOT known yet',
    haveDates ? `${nights} nights from ${arrivalDate}` : 'dates NOT known yet',
  ].join('; ');

  const system =
`You are Anchor — a warm, sharp Tokyo local the traveler is texting. You handle BOTH trip setup and recommendations in this one chat. Today is ${todayStr()}; the destination is always Tokyo.

What you know:
- Trip: ${setupLine}
- Loves: ${likes}
- Avoids: ${dislikes}
- Interests: ${prefs}
- ANCHORED places (they're building their trip around these — your strongest taste signal): ${anchored}
- Saved ideas: ${ideas}

Each turn do ALL of this:
1) REPLY like a knowledgeable friend: concise, warm, specific. Plain text only — no markdown or asterisks. 2-4 sentences. You may mention the places by name.
2) RECOMMEND: whenever they want places, you MUST list every place you suggest in "places" — 1-4 SPECIFIC, REAL, currently-operating Tokyo venues, each {name, area, why}. "why" is one short clause tied to THIS person. Respect TIMING: for "late night" pick spots genuinely open late (izakaya, ramen, late bars), NOT places that close early; for breakfast pick morning spots, etc. Favor their hotel area (${hotelArea || 'unknown'}) unless they name another. NEVER recommend a place they've already anchored or saved. If it's just chatting, leave "places" empty.
3) SETUP: if stay or dates are unknown, work ONE friendly question into your reply and capture facts in "updates" (parse relative dates against today).
4) LEARN: infer taste from their anchored/saved places and from this message.

Output ONLY a JSON object, no prose:
{"reply":"...","places":[{"name":"<real venue>","area":"<neighborhood>","why":"<one clause for them>"}],"updates":{"hotelName":"","hotelArea":"","arrivalDate":"YYYY-MM-DD","nights":0,"prefs":[]},"learned":{"likes":[],"dislikes":[]},"chips":["<=3 short suggested replies"]}`;

  const transcript = messages.map(m => `${m.role === 'user' ? 'Traveler' : 'Anchor'}: ${m.content}`).join('\n');
  const out = await callModel(env, model, system, messages, transcript);
  if (out.error) {
    return json({ error: out.error, model, reply: 'I had trouble thinking just now — try again, or flip the model switch up top.', ...EMPTY, detail: out.detail }, 200);
  }

  const parsed = extractJson(out.text) || { reply: out.text };

  // ── recommendations: model-named places, then grounded via live lookup ──
  const savedSet = new Set([...anchoredArr, ...ideasArr].map(s => String(s || '').toLowerCase()));
  let places = Array.isArray(parsed.places) ? parsed.places
    .filter(p => p && typeof p.name === 'string' && p.name.trim())
    .map(p => ({ name: String(p.name).slice(0, 80), area: String(p.area || hotelArea || '').slice(0, 40), why: String(p.why || '').slice(0, 140) }))
    .filter(p => !savedSet.has(p.name.toLowerCase()))
    .slice(0, 4) : [];
  if (env.GOOGLE_PLACES_API_KEY && places.length) {
    await Promise.all(places.map(async p => {
      const info = await lookupPlace(env, p.name, p.area);
      if (info) {
        if (info.name) p.name = info.name;
        p.rating = info.rating; p.reviews = info.reviews; p.budget = info.budget;
        p.category = info.category; p.coords = info.coords; p.googleUrl = info.googleUrl;
        p.address = info.address; p.openNow = info.openNow;
      }
    }));
    // Show currently-open spots first.
    places.sort((a, b) => (a.openNow === 'closed' ? 1 : 0) - (b.openNow === 'closed' ? 1 : 0));
  }

  // ── trip-setup updates (validated) ──
  const u = parsed.updates || {};
  const clean = a => Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 40)))].slice(0, 6) : [];
  const updates = {};
  if (typeof u.hotelName === 'string' && u.hotelName.trim()) updates.hotelName = u.hotelName.trim().slice(0, 80);
  if (typeof u.hotelArea === 'string' && u.hotelArea.trim()) updates.hotelArea = u.hotelArea.trim().slice(0, 40);
  if (typeof u.arrivalDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(u.arrivalDate)) updates.arrivalDate = u.arrivalDate;
  if (Number.isFinite(u.nights)) updates.nights = Math.max(1, Math.min(60, Math.round(u.nights)));
  if (Array.isArray(u.prefs)) { const p = clean(u.prefs); if (p.length) updates.prefs = p; }

  const ld = parsed.learned || {};
  const learned = { likes: clean(ld.likes), dislikes: clean(ld.dislikes) };
  const chips = Array.isArray(parsed.chips) ? parsed.chips.filter(c => typeof c === 'string' && c.trim()).map(c => c.slice(0, 40)).slice(0, 3) : [];

  // Ensure the hotel anchor has coordinates so distance-to-hotel works.
  const hName = updates.hotelName || hotelName;
  const hArea = updates.hotelArea || hotelArea;
  if (env.GOOGLE_PLACES_API_KEY && (hName || hArea) && (updates.hotelName || updates.hotelArea || !hotelCoords)) {
    const hi = await lookupPlace(env, hName || hArea, hArea);
    if (hi && hi.coords) updates.hotelCoords = hi.coords;
  }

  return json({
    model: out.modelName || model,
    reply: (String(parsed.reply || '').slice(0, 700)) || 'Tell me a bit more about what you’re after.',
    places, learned, updates, chips,
  });
}

// Call the selected model and return its raw text. Both share one JSON contract;
// Claude gets real multi-turn messages, DeepSeek gets a flat transcript.
async function callModel(env, model, system, messages, transcript) {
  if (model === 'deepseek') {
    const o = await callDeepSeek(env, { system, user: transcript, maxTokens: 900, json: true });
    if (o.error) return { error: o.error, detail: o.detail };
    return { text: o.text, modelName: 'deepseek' };
  }
  const MODEL = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, system, messages }),
    });
  } catch (e) { return { error: 'fetch_failed', detail: String(e).slice(0, 200) }; }
  if (!r.ok) { const d = await r.text(); return { error: 'anthropic_error', detail: d.slice(0, 300) }; }
  let data; try { data = await r.json(); } catch { return { error: 'anthropic_parse' }; }
  return { text: (data.content || []).map(b => b.text || '').join('').trim(), modelName: 'claude' };
}
