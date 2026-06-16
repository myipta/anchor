// GET /api/health
// Reports whether keys are configured — WITHOUT ever returning the key values.
// Handy for confirming a deploy picked up your Cloudflare env vars.

import { json, preflight } from './_lib.js';

export async function onRequest(context) {
  const { request, env } = context;
  const pf = preflight(request); if (pf) return pf;

  return json({
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
  });
}
