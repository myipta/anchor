// POST /api/refine
// Body: { message: string, prefs?: string[], taste?: {likes:string[], dislikes:string[]}, history?: [{role,text}] }
// Returns: { reply, add_likes:[], add_dislikes:[], model }
//
// The Discover "train Anchor" chat. DeepSeek replies conversationally and
// extracts new likes/dislikes from what the traveler says, so Discover can
// tune itself over time. Fails soft (the app keeps its current taste).

import { json, preflight, requireMethod, callDeepSeek, extractJson } from './_lib.js';

const SYSTEM = `You are Anchor, a warm, concise Tokyo travel taste assistant.
The traveler is telling you what they like or dislike so you can tune their Discover feed.
Reply in 1-2 short, friendly sentences that acknowledge what they said and, when natural, ask one follow-up.
Then extract any NEW concrete taste signals from THIS message.

Return ONLY JSON:
{
  "reply": "your short conversational reply",
  "add_likes": ["short lowercase tags, e.g. 'natural wine', 'standing bars', 'quiet cafes'"],
  "add_dislikes": ["short lowercase tags, e.g. 'tourist crowds', 'loud izakaya', 'chain ramen'"]
}
Rules: tags are 1-3 words, lowercase, concrete (cuisine, vibe, setting). Empty arrays if nothing new. Never repeat tags already present.`;

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;
  const bad = requireMethod(request, 'POST'); if (bad) return bad;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const message = (body.message || '').toString().slice(0, 800).trim();
  if (!message) return json({ error: 'no_message' }, 400);
  const prefs = Array.isArray(body.prefs) ? body.prefs.slice(0, 30) : [];
  const taste = body.taste && typeof body.taste === 'object' ? body.taste : {};
  const likes = Array.isArray(taste.likes) ? taste.likes.slice(0, 40) : [];
  const dislikes = Array.isArray(taste.dislikes) ? taste.dislikes.slice(0, 40) : [];
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

  if (!env.DEEPSEEK_API_KEY) {
    return json({ error: 'missing_key', reply: 'Taste training needs the DeepSeek key configured on the server.', add_likes: [], add_dislikes: [] }, 503);
  }

  const convo = history.map(h => `${h.role === 'user' ? 'Traveler' : 'Anchor'}: ${h.text}`).join('\n');
  const user = `Onboarding prefs: ${prefs.join(', ') || '(none)'}
Current likes: ${likes.join(', ') || '(none)'}
Current dislikes: ${dislikes.join(', ') || '(none)'}
${convo ? 'Recent conversation:\n' + convo + '\n' : ''}Traveler just said: "${message}"`;

  const out = await callDeepSeek(env, { system: SYSTEM, user, maxTokens: 400, json: true });
  if (out.error) return json({ error: out.error, detail: out.detail, reply: '', add_likes: [], add_dislikes: [] }, out.status || 502);

  const parsed = extractJson(out.text) || {};
  const clean = a => Array.isArray(a) ? [...new Set(a.map(s => String(s).toLowerCase().trim()).filter(s => s && s.length <= 30))].slice(0, 6) : [];
  return json({
    reply: (parsed.reply || 'Got it — noted.').toString().slice(0, 400),
    add_likes: clean(parsed.add_likes),
    add_dislikes: clean(parsed.add_dislikes),
    model: out.model,
  });
}
