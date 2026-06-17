// Shared helpers for Anchor API functions.
// Files prefixed with "_" are NOT routed by Cloudflare Pages — import-only.

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extraHeaders },
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

// Call DeepSeek (OpenAI-compatible chat completions). Returns
// { text, model } on success or { error, status, detail } on failure.
// Used for the cheap/fast "Haiku-tier" work. Key: DEEPSEEK_API_KEY.
export async function callDeepSeek(env, { system, user, maxTokens = 1024, json: wantJson = false, think = false }) {
  const model = env.DEEPSEEK_MODEL || 'deepseek-v4-pro';
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const body = { model, messages, max_tokens: maxTokens, stream: false };
  // deepseek-v4-pro is a thinking model: with thinking ON it spends the token
  // budget on hidden reasoning_content and returns an EMPTY content. Our calls
  // are short structured extractions, so disable thinking → the answer lands in
  // message.content directly (and fast). Pass think:true to opt back in.
  body.thinking = { type: think ? 'enabled' : 'disabled' };
  // DeepSeek honors OpenAI-style JSON mode; the prompt must mention "json".
  if (wantJson) body.response_format = { type: 'json_object' };

  let r;
  try {
    r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { error: 'fetch_failed', status: 502, detail: String(e).slice(0, 300) };
  }
  if (!r.ok) {
    const detail = await r.text();
    return { error: 'deepseek_error', status: r.status, detail: detail.slice(0, 500) };
  }
  const data = await r.json();
  const choice = data.choices?.[0] || {};
  const msg = choice.message || {};
  // Prefer the final answer (content). If a thinking model still left content
  // empty, salvage from reasoning_content so callers never get a blank string.
  let text = (msg.content || '').trim();
  if (!text && msg.reasoning_content) text = String(msg.reasoning_content).trim();
  return { text, model, finish: choice.finish_reason || null };
}

