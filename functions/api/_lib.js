// Shared helpers for Anchor API functions.
// Files prefixed with "_" are NOT routed by Cloudflare Pages — import-only.

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });
}

// Returns a 204 response for CORS preflight, or null to continue.
export function preflight(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  return null;
}

// Returns a 405 response if the method is wrong, or null to continue.
export function requireMethod(request, method) {
  if (request.method !== method) return json({ error: 'method_not_allowed', allow: method }, 405);
  return null;
}

// Pull the first balanced JSON object out of a model's text response.
export function extractJson(text) {
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
