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

// Create tables idempotently on first use, so no manual `wrangler d1 execute`.
let _schemaReady = false;
export async function ensureSchema(env) {
  if (_schemaReady || !env.DB) return;
  try {
    await env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS login_codes (email TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id)'),
    ]);
    _schemaReady = true;
  } catch (e) { /* fail soft; next call retries */ }
}

// Allowlist gate for account creation. AUTH_ALLOWLIST is a comma-separated list
// of approved emails. If it's unset, the gate is OPEN (so the owner isn't locked
// out before configuring) — set it to start approving individually.
export function allowlistConfigured(env) {
  return Boolean((env.AUTH_ALLOWLIST || '').trim());
}
export function isAllowed(email, env) {
  const list = (env.AUTH_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  return list.includes(normalizeEmail(email));
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
