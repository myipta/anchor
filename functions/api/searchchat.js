// POST /api/searchchat
// Body: { messages:[{role:'user'|'assistant',content}], taste?, prefs?, area? }
// Returns: { action:'search'|'reply', reply, query, places, source, model }
//
// Conversational Tokyo place search. DeepSeek reads the chat, decides whether a
// search is needed, writes a concrete query + a warm one-line reply; we run the
// shared search pipeline (_search.js) and attach the ranked places. The model is
// swappable to Claude later via callClaude. Fails soft at every stage.

import { json, preflight, requireMethod, callDeepSeek, extractJson } from './_lib.js';
import { runSearch } from './_search.js';

const SYSTEM = `You are Anchor, a warm, concise Tokyo search concierge. The traveler chats with you to find real places in Tokyo (food, coffee, bars, sights, shopping, nature, nightlife...).
Decide if their LATEST message needs a place SEARCH.
- If they want places, set action="search", write "query" as a short Google-style search phrase (e.g. "quiet specialty coffee", "standing sushi counter", "vintage shops"), set "area" to a single Tokyo neighborhood if they named or implied one (else ""), and write "reply" as ONE warm sentence that introduces the results. Do NOT list places yourself — the app shows them as cards.
- If it's small talk or a follow-up that needs no new search, set action="reply" and answer warmly in 1-2 sentences.
Return ONLY JSON: {"action":"search"|"reply","query":"...","area":"...","reply":"..."}`;

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (!history.length) return json({ error: 'no_messages', reply: '', places: [] }, 400);
  const taste = (body.taste && typeof body.taste === 'object') ? body.taste : {};
  const prefs = Array.isArray(body.prefs) ? body.prefs.slice(0, 20) : [];
  const defaultArea = (body.area || '').toString().trim();

  // No model configured: degrade to a plain search on the latest user message.
  if (!env.DEEPSEEK_API_KEY) {
    const q = lastUser(history);
    if (!q) return json({ error: 'missing_key', reply: 'Search needs the DeepSeek key configured on the server.', places: [] }, 503);
    const out = await runSearch(env, { query: q, area: defaultArea, taste, prefs, limit: 12 });
    return json({ action: 'search', query: q, reply: replyFor(q, out), places: out.places || [], source: out.source });
  }

  const convo = history
    .map(h => `${h.role === 'user' ? 'Traveler' : 'Anchor'}: ${String(h.content || '').slice(0, 500)}`)
    .join('\n');
  const user = `Traveler taste — likes: ${(taste.likes || []).join(', ') || '(none)'}; dislikes: ${(taste.dislikes || []).join(', ') || '(none)'}; onboarding prefs: ${prefs.join(', ') || '(none)'}.
Conversation:
${convo}`;

  const interp = await callDeepSeek(env, { system: SYSTEM, user, maxTokens: 300, json: true });
  let plan = (!interp.error && extractJson(interp.text)) || null;
  if (!plan || typeof plan !== 'object') plan = { action: 'search', query: lastUser(history), area: '', reply: '' };

  // Pure conversational turn — no search needed.
  if (plan.action === 'reply' && plan.reply) {
    return json({ action: 'reply', reply: String(plan.reply).slice(0, 500), places: [], model: interp.model });
  }

  const query = (plan.query || lastUser(history) || '').toString().trim();
  if (!query) {
    return json({ action: 'reply', reply: String(plan.reply || 'Tell me what kind of place you’re after.').slice(0, 500), places: [], model: interp.model });
  }

  const out = await runSearch(env, { query, area: (plan.area || defaultArea).toString().trim(), taste, prefs, limit: 12 });
  const reply = String(plan.reply || '').trim() || replyFor(query, out);
  return json({ action: 'search', query, reply, places: out.places || [], source: out.source, model: interp.model });
}

function lastUser(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] && history[i].role === 'user') return String(history[i].content || '').slice(0, 200).trim();
  }
  return '';
}

function replyFor(query, out) {
  if (out.places && out.places.length) return `Here are some spots for “${query}.”`;
  return out.message || `I couldn't find places for “${query}.” Try rephrasing?`;
}
