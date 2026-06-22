// POST /api/concierge
// Body: { messages:[{role,content}], context:{...}, model?:'claude'|'deepseek' }
// Returns: { model, reply, recommend, search, area, learned, updates, chips }
//
// The conversational brain only. The chosen model (Claude or DeepSeek) replies
// and, when the traveler wants places, decides WHAT to look for (genre/keywords
// + Tokyo area). The client then fetches grounded cards from /api/tabelog so the
// reply shows instantly and cards stream in. Also handles trip setup. Fails soft.

import { json, preflight, requireMethod, extractJson, callDeepSeek } from './_lib.js';
import { lookupPlace } from './_search.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const EMPTY = { recommend: false, search: '', area: '', learned: { likes: [], dislikes: [] }, updates: {}, chips: [] };

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
  const anchored = (Array.isArray(ctx.anchored) ? ctx.anchored : []).slice(0, 25).join(', ') || '(none yet)';
  const ideas = (Array.isArray(ctx.ideas) ? ctx.ideas : []).slice(0, 25).join(', ') || '(none yet)';
  const hotelArea = (ctx.hotelArea || '').toString().trim();
  const hotelName = (ctx.hotelName || '').toString().trim();
  const arrivalDate = (ctx.arrivalDate || '').toString().trim();
  const hotelCoords = (ctx.hotelCoords || '').toString().trim();
  const nights = ctx.nights || 0;
  const flights = (Array.isArray(ctx.flights) ? ctx.flights : []).slice(0, 8);
  const arrivalFlight = (ctx.arrivalFlight && typeof ctx.arrivalFlight === 'object') ? ctx.arrivalFlight : null;
  const fmtFlight = f => {
    const airline = (f.airline || '').toString().trim();
    const number = (f.flightNumber || '').toString().trim();
    const from = (f.departAirport || '').toString().trim();
    const to = (f.arriveAirport || f.arriveCity || '').toString().trim();
    const at = (f.arriveAt || '').toString().trim();
    const terminal = (f.terminal || '').toString().trim();
    return [airline || number ? `${airline} ${number}`.trim() : '', from || to ? `${from || '?'} -> ${to || '?'}` : '', at ? `arrives ${at}` : '', terminal ? `terminal ${terminal}` : ''].filter(Boolean).join('; ');
  };
  const flightLine = arrivalFlight
    ? `Arrival flight: ${fmtFlight(arrivalFlight) || 'known but details sparse'}`
    : (flights.length ? `Flights: ${flights.map(fmtFlight).filter(Boolean).join(' | ')}` : 'Flights: none known');
  const haveStay = Boolean(hotelArea || hotelName);
  const haveDates = Boolean(arrivalDate && nights);
  const setupLine = [
    haveStay ? `staying ${hotelName ? `at ${hotelName} ` : ''}${hotelArea ? `(${hotelArea})` : ''}`.trim() : 'stay NOT known yet',
    haveDates ? `${nights} nights from ${arrivalDate}` : 'dates NOT known yet',
  ].join('; ');

  const system =
`You are Anchor — a warm, sharp Tokyo local the traveler is texting. You handle BOTH trip setup and recommendations in this one chat. Today is ${todayStr()}; the destination is always Tokyo. Restaurant recommendations are sourced from Tabelog, so trust Tabelog-style genres.

What you know:
- Trip: ${setupLine}
- Loves: ${likes}
- Avoids: ${dislikes}
- Interests: ${prefs}
- ANCHORED places (they're building their trip around these — your strongest taste signal): ${anchored}
- Saved ideas: ${ideas}
- Flight context: ${flightLine}

Each turn do ALL of this:
1) REPLY like a knowledgeable friend: concise, warm, specific. Plain text only — no markdown or asterisks. 2-4 sentences. Focus on their CURRENT message — don't fold in earlier topics or cuisines they asked about before. Set up expectation for the cards (e.g. "Here are some izakaya near you") but you do NOT need to name specific venues — the app shows real results as cards.
2) RECOMMEND: if they want places, set recommend=true and write "search" = a concise query of GENRE + keywords + timing for the current ask (e.g. "izakaya late night", "specialty coffee", "omakase sushi", "tonkotsu ramen"). CRITICAL: "search" must reflect ONLY their CURRENT request — never combine it with earlier ones. If they discussed tofu kaiseki before and now ask for an izakaya, search just "izakaya", NOT "tofu izakaya". Each request is a fresh search. Set "area" = the Tokyo neighborhood to search (default their hotel area ${hotelArea || 'unknown'} unless they name another). If it's just chatting, recommend=false.
3) FLIGHT CONTEXT: if they ask about arrival, first move, after landing, airport, luggage, jet lag, route to hotel, or a meal around arrival time, use Flight context. Prefer easy post-flight plans around the arrival airport or hotel area. Put airport/hotel-appropriate terms in search (for example "easy lunch Haneda", "coffee Haneda", "casual dinner Shinjuku") and set area to the arrival airport/neighborhood or hotel area. If they ask for routing rather than venues, answer helpfully and set recommend=false unless they also want places.
4) SETUP: if stay or dates are unknown, work ONE friendly question into your reply and capture facts in "updates" (parse relative dates against today).
5) LEARN — sparingly: only when they reveal a genuinely NEW, reusable preference, add 1-2 SHORT generic tags (1-3 words, lowercase) to learned — e.g. "izakaya", "late night", "date night", "craft beer". NO locations, hotel names, durations, or full sentences. Usually leave learned empty; do not restate things you already know.

Output ONLY a JSON object, no prose:
{"reply":"...","recommend":<bool>,"search":"<genre+keywords or ''>","area":"<neighborhood or ''>","updates":{"hotelName":"","hotelArea":"","arrivalDate":"YYYY-MM-DD","nights":0,"prefs":[]},"learned":{"likes":[],"dislikes":[]},"chips":["<=3 short suggested replies"]}`;

  const transcript = messages.map(m => `${m.role === 'user' ? 'Traveler' : 'Anchor'}: ${m.content}`).join('\n');
  const out = await callModel(env, model, system, messages, transcript);
  if (out.error) {
    return json({ error: out.error, model, reply: 'I had trouble thinking just now — try again, or flip the model switch up top.', ...EMPTY, detail: out.detail }, 200);
  }

  const parsed = extractJson(out.text) || { reply: out.text };

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

  // Ensure the hotel anchor has coordinates so distance-to-hotel works (quick).
  const hName = updates.hotelName || hotelName;
  const hArea = updates.hotelArea || hotelArea;
  if (env.GOOGLE_PLACES_API_KEY && (hName || hArea) && (updates.hotelName || updates.hotelArea || !hotelCoords)) {
    const hi = await lookupPlace(env, hName || hArea, hArea);
    if (hi && hi.coords) updates.hotelCoords = hi.coords;
  }

  return json({
    model: out.modelName || model,
    reply: (String(parsed.reply || '').slice(0, 700)) || 'Tell me a bit more about what you’re after.',
    recommend: Boolean(parsed.recommend),
    search: (parsed.search || '').toString().slice(0, 120),
    area: (parsed.area || '').toString().slice(0, 40),
    learned, updates, chips,
  });
}

// Call the selected model and return its raw text. Both share one JSON contract;
// Claude gets real multi-turn messages, DeepSeek gets a flat transcript.
async function callModel(env, model, system, messages, transcript) {
  if (model === 'deepseek') {
    const o = await callDeepSeek(env, { system, user: transcript, maxTokens: 700, json: true });
    if (o.error) return { error: o.error, detail: o.detail };
    return { text: o.text, modelName: 'deepseek' };
  }
  const MODEL = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 800, system, messages }),
    });
  } catch (e) { return { error: 'fetch_failed', detail: String(e).slice(0, 200) }; }
  if (!r.ok) { const d = await r.text(); return { error: 'anthropic_error', detail: d.slice(0, 300) }; }
  let data; try { data = await r.json(); } catch { return { error: 'anthropic_parse' }; }
  return { text: (data.content || []).map(b => b.text || '').join('').trim(), modelName: 'claude' };
}
