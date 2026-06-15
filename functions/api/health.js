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
      anthropic: Boolean(env.ANTHROPIC_API_KEY),
      googlePlaces: Boolean(env.GOOGLE_PLACES_API_KEY),
    },
    model: env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    time: new Date().toISOString(),
  });
}
