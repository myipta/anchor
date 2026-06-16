-- Anchor database schema (Cloudflare D1 / SQLite). Multi-tenant.
-- Apply locally:  npx wrangler d1 execute anchor --local --file=./schema.sql
-- Apply to prod:  npx wrangler d1 execute anchor --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,          -- uuid
  email      TEXT UNIQUE NOT NULL,      -- lowercased
  created_at INTEGER NOT NULL           -- epoch ms
);

-- Short-lived 6-digit email login codes. Only the hash is stored.
CREATE TABLE IF NOT EXISTS login_codes (
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,             -- sha-256 hex of the code
  expires_at INTEGER NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_codes_email ON login_codes(email);

-- Session tokens. Only the hash is stored; the raw token lives in an httpOnly cookie.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,          -- sha-256 hex of the session token
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- One trip blob per user (the app's full `trip` object as JSON). The schema
-- allows many rows per user so multi-trip is a later, non-breaking change.
CREATE TABLE IF NOT EXISTS trips (
  id         TEXT PRIMARY KEY,          -- uuid
  user_id    TEXT NOT NULL,
  data       TEXT NOT NULL,             -- JSON
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id);
