/** Durable, append-only vocabulary backup and per-device progress snapshots.
 * This module uses the D1 binding already attached to Anchor. There is no
 * endpoint to delete remote packs: an empty install cannot erase a backup.
 */
const MAX_PACKS = 128;
const MAX_PROFILES = 20;

const badRequest = message => Object.assign(new Error(message), { status: 400 });

async function ensureTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS spywords_cloud_packs (
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS spywords_cloud_profiles (
      device_id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL
    )`),
  ]);
}

function validPack(pack, validatePack) {
  return pack && typeof pack.id === 'string' && /^custom-[a-z0-9-]{8,70}$/i.test(pack.id) &&
    typeof pack.title === 'string' && pack.title.length <= 120 &&
    typeof pack.source === 'string' && pack.source.length <= 250 &&
    pack.status === 'approved' && Array.isArray(pack.trapWords) &&
    Array.isArray(pack.words) && pack.words.length >= 1 && pack.words.length <= 12 &&
    validatePack(pack.words, [], pack.words.length) && JSON.stringify(pack).length <= 80_000;
}

function validProgress(progress) {
  return progress && typeof progress === 'object' && !Array.isArray(progress) &&
    typeof progress.agentName === 'string' && progress.agentName.length <= 30 &&
    Number.isInteger(progress.xp) && progress.xp >= 0 && progress.xp < 1e9 &&
    Number.isInteger(progress.totalAnswered) && progress.totalAnswered >= 0 && progress.totalAnswered < 1e8 &&
    Number.isInteger(progress.totalCorrect) && progress.totalCorrect >= 0 && progress.totalCorrect <= progress.totalAnswered &&
    progress.wordProgress && typeof progress.wordProgress === 'object' &&
    !Array.isArray(progress.wordProgress) && Object.keys(progress.wordProgress).length <= 10000 &&
    Array.isArray(progress.sessionHistory) && progress.sessionHistory.length <= 60 &&
    JSON.stringify(progress).length <= 400_000;
}

async function snapshot(db) {
  const [packs, profiles] = await db.batch([
    db.prepare('SELECT payload FROM spywords_cloud_packs ORDER BY created_at ASC, id ASC LIMIT 128'),
    db.prepare('SELECT device_id, payload FROM spywords_cloud_profiles ORDER BY updated_at DESC LIMIT 20'),
  ]);
  return {
    version: 1,
    packs: (packs.results || []).map(r => JSON.parse(r.payload)),
    profiles: (profiles.results || []).map(r => ({ deviceId: r.device_id, profile: JSON.parse(r.payload) })),
  };
}

export async function handleSpyWordsSync(request, env, { readJSON, validatePack, send }) {
  if (!env.DB) return send(503, {error: 'Anchor D1 storage is not configured'});
  await ensureTables(env.DB);
  if (request.method === 'GET') return send(200, await snapshot(env.DB));
  if (request.method !== 'POST') return send(405, {error:'Method not allowed'});

  const input = await readJSON(request, 1_000_000);
  if (!input || !Array.isArray(input.packs) || input.packs.length > MAX_PACKS ||
      typeof input.deviceId !== 'string' || !/^[a-z0-9-]{8,80}$/i.test(input.deviceId) ||
      !validProgress(input.profile)) throw badRequest('Invalid cloud sync payload');
  const ids = new Set();
  const words = new Set();
  for (const pack of input.packs) {
    if (!validPack(pack, validatePack) || ids.has(pack.id)) throw badRequest('Invalid or repeated word pack');
    ids.add(pack.id);
    for (const word of pack.words) {
      const lemma = word.lemma.toLowerCase();
      if (words.has(lemma)) throw badRequest('Duplicate vocabulary across local packs');
      words.add(lemma);
    }
  }
  const now = Date.now();
  const inserts = input.packs.map((pack, index) => env.DB.prepare(
    'INSERT OR IGNORE INTO spywords_cloud_packs (id, payload, created_at) VALUES (?, ?, ?)'
  ).bind(pack.id, JSON.stringify(pack), now + index));
  inserts.push(env.DB.prepare(`INSERT INTO spywords_cloud_profiles (device_id, payload, updated_at)
    VALUES (?, ?, ?) ON CONFLICT(device_id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`)
    .bind(input.deviceId, JSON.stringify(input.profile), now));
  // D1.batch is transactional. Existing pack IDs are never overwritten/deleted.
  await env.DB.batch(inserts);
  return send(200, await snapshot(env.DB));
}
