// Auth + session helpers for Anchor (Cloudflare D1 + httpOnly cookie sessions).
// Import-only (underscore prefix is not routed).

import { json } from './_lib.js';

const SESSION_DAYS = 60;
const COOKIE = 'sid';

export async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

// 6-digit numeric login code, uniformly random.
export function randomCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
export function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Returns a 503 Response if D1 isn't bound (so the client can fall back to
// offline/local mode), or null to continue.
export function requireDB(env) {
  if (!env.DB) return json({ error: 'cloud_unconfigured', message: 'Cloud sync is not set up on this deployment.' }, 503);
  return null;
}

function parseCookies(request) {
  const out = {};
  const raw = request.headers.get('cookie') || '';
  raw.split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function sessionCookie(request, token, maxAgeSec) {
  const secure = new URL(request.url).protocol === 'https:' ? ' Secure;' : '';
  const exp = maxAgeSec === 0 ? ' Max-Age=0;' : ` Max-Age=${maxAgeSec};`;
  return `${COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Lax;${exp}`;
}

// Create a session row and return { token, maxAge }.
export async function createSession(env, userId) {
  const token = randomToken();
  const now = Date.now();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .bind(await sha256(token), userId, now, now + maxAge * 1000).run();
  return { token, maxAge };
}

// Resolve the current user from the session cookie, or null.
export async function getUser(request, env) {
  if (!env.DB) return null;
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash=?')
    .bind(await sha256(token)).first();
  if (!row || row.expires_at < Date.now()) return null;
  const user = await env.DB.prepare('SELECT id, email FROM users WHERE id=?').bind(row.user_id).first();
  return user || null;
}

export async function deleteSession(request, env) {
  if (!env.DB) return;
  const token = parseCookies(request)[COOKIE];
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
}

// Convenience: 401 helper.
export function unauthorized() {
  return json({ error: 'unauthorized', message: 'Please sign in.' }, 401);
}
