// GET /api/health
// Reports whether keys are configured — WITHOUT ever returning the key values.
// Add ?probe=1 to make a tiny live call to DeepSeek and report the exact
// status/error (handy for diagnosing why a model call fails). The probe never
// returns the key, only the HTTP status and a short error snippet.

import { json, preflight } from './_lib.js';
import { tabelogProbe, tabelogActorInfo } from './_tabelog.js';
import { sendLoginCode } from './_email.js';

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
      apify: Boolean(env.APIFY_TOKEN),
    },
    tabelogActor: env.APIFY_TABELOG_ACTOR || 'parseforge~tabelog-scraper',
    // Cloud accounts/sync require BOTH a bound D1 database and an email sender.
    // If db:false, the app is in offline/local mode and shows no login.
    cloud: {
      db: Boolean(env.DB),
      email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
      allowlist: (env.AUTH_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean).length, // # approved emails (0 = gate open)
      devAuth: env.DEV_AUTH === '1',
    },
    suggestModel: env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
    chatModel: env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    time: new Date().toISOString(),
  };

  const url = new URL(request.url);
  if (url.searchParams.get('email')) {
    // Test-send via Resend and surface the exact result (status + error detail),
    // e.g. /api/health?email=you@example.com
    base.emailFrom = env.EMAIL_FROM || null;
    base.emailTest = await sendLoginCode(env, url.searchParams.get('email'), '000000');
  }
  if (url.searchParams.get('actor')) {
    base.actor = await tabelogActorInfo(env);
  }
  if (url.searchParams.get('probe')) {
    base.probe = {
      deepseek: await probeDeepseek(env),
      places: await probePlaces(env),
      tabelog: await tabelogProbe(env, {}),
    };
  }
  return json(base);
}

// Minimal live Google Places text search to confirm search actually returns
// results (a present-but-disabled/unbilled key is the usual "nothing comes back").
async function probePlaces(env) {
  if (!env.GOOGLE_PLACES_API_KEY) return { configured: false, message: 'GOOGLE_PLACES_API_KEY is not set' };
  const t0 = Date.now();
  let r;
  try {
    r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': 'places.displayName' },
      body: JSON.stringify({ textQuery: 'coffee in Shibuya, Tokyo', maxResultCount: 3, languageCode: 'en', regionCode: 'JP' }),
    });
  } catch (e) {
    return { configured: true, error: 'fetch_failed', detail: String(e).slice(0, 300), ms: Date.now() - t0 };
  }
  const text = await r.text();
  let count = null;
  try { count = (JSON.parse(text)?.places || []).length; } catch {}
  return {
    configured: true,
    status: r.status,
    ok: r.ok,
    count,            // >0 means search will return results
    ms: Date.now() - t0,
    detail: r.ok ? undefined : text.slice(0, 400), // raw error (e.g. API disabled / billing)
  };
}

// Minimal live DeepSeek call to surface the real failure reason.
async function probeDeepseek(env) {
  if (!env.DEEPSEEK_API_KEY) return { configured: false, message: 'DEEPSEEK_API_KEY is not set' };
  const model = env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
  const t0 = Date.now();
  let r;
  try {
    r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      // Mirror callDeepSeek: thinking disabled so the answer lands in content.
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], max_tokens: 20, stream: false, thinking: { type: 'disabled' } }),
    });
  } catch (e) {
    return { configured: true, model, error: 'fetch_failed', detail: String(e).slice(0, 300), ms: Date.now() - t0 };
  }
  const text = await r.text();
  let reply = null, finish = null, hadReasoning = false;
  try {
    const c = JSON.parse(text)?.choices?.[0] || {};
    reply = c.message?.content;
    finish = c.finish_reason ?? null;
    hadReasoning = Boolean(c.message?.reasoning_content);
  } catch {}
  return {
    configured: true,
    model,
    status: r.status,
    ok: r.ok,
    ms: Date.now() - t0,
    reply: reply ?? null,
    finish,            // 'stop' = healthy; 'length' = budget exhausted (thinking leak)
    thinkingLeak: hadReasoning, // true if the model still emitted reasoning_content
    detail: r.ok ? undefined : text.slice(0, 400), // raw error body (e.g. "Insufficient Balance")
  };
}
