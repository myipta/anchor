// GET /api/health
// Reports whether keys are configured — WITHOUT ever returning the key values.
// Add ?probe=1 to make a tiny live call to DeepSeek and report the exact
// status/error (handy for diagnosing why a model call fails). The probe never
// returns the key, only the HTTP status and a short error snippet.

import { json, preflight } from './_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;

  const base = {
    ok: true,
    service: 'anchor-api',
    keys: {
      deepseek: Boolean(env.DEEPSEEK_API_KEY),
      googlePlaces: Boolean(env.GOOGLE_PLACES_API_KEY),
      anthropic: Boolean(env.ANTHROPIC_API_KEY),
    },
    suggestModel: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    chatModel: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    time: new Date().toISOString(),
  };

  const url = new URL(request.url);
  if (url.searchParams.get('probe')) {
    base.probe = { deepseek: await probeDeepseek(env) };
  }
  return json(base);
}

// Minimal live DeepSeek call to surface the real failure reason.
async function probeDeepseek(env) {
  if (!env.DEEPSEEK_API_KEY) return { configured: false, message: 'DEEPSEEK_API_KEY is not set' };
  const model = env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
  const t0 = Date.now();
  let r;
  try {
    r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], max_tokens: 5, stream: false }),
    });
  } catch (e) {
    return { configured: true, model, error: 'fetch_failed', detail: String(e).slice(0, 300), ms: Date.now() - t0 };
  }
  const text = await r.text();
  let reply = null;
  try { reply = JSON.parse(text)?.choices?.[0]?.message?.content; } catch {}
  return {
    configured: true,
    model,
    status: r.status,
    ok: r.ok,
    ms: Date.now() - t0,
    reply: reply ?? null,
    detail: r.ok ? undefined : text.slice(0, 400), // raw error body (e.g. "Insufficient Balance")
  };
}
