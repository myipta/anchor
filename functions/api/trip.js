// /api/trip
//   GET -> { trip:<obj|null>, updated_at }   (the signed-in user's saved trip)
//   PUT { data, updated_at? } -> { ok, updated_at }   (upsert; one trip library per user)

import { json, preflight } from './_lib.js';
import { requireDB, getUser, unauthorized } from './_auth.js';

export async function onRequest({ request, env }) {
  const pf = preflight(request); if (pf) return pf;
  const noDb = requireDB(env); if (noDb) return noDb;
  const user = await getUser(request, env);
  if (!user) return unauthorized();

  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT data, updated_at FROM trips WHERE user_id=?').bind(user.id).first();
    let trip = null;
    if (row) { try { trip = JSON.parse(row.data); } catch { trip = null; } }
    return json({ trip, updated_at: row?.updated_at || null });
  }

  if (request.method === 'PUT') {
    let body; try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }
    if (!body || typeof body.data !== 'object' || body.data === null) return json({ error: 'bad_data' }, 400);
    const now = Date.now();
    const existing = await env.DB.prepare('SELECT id, data, updated_at FROM trips WHERE user_id=?').bind(user.id).first();
    let stored = null;
    if (existing?.data) { try { stored = JSON.parse(existing.data); } catch { stored = null; } }
    const next = mergeTripDataForSave(stored, body.data, { existingUpdatedAt: existing?.updated_at || 0, now });
    const dataStr = JSON.stringify(next);
    if (existing) {
      await env.DB.prepare('UPDATE trips SET data=?, updated_at=? WHERE user_id=?').bind(dataStr, now, user.id).run();
    } else {
      await env.DB.prepare('INSERT INTO trips (id, user_id, data, updated_at) VALUES (?,?,?,?)')
        .bind(crypto.randomUUID(), user.id, dataStr, now).run();
    }
    return json({ ok: true, updated_at: now });
  }

  return json({ error: 'method_not_allowed', allow: 'GET,PUT' }, 405);
}

const LIBRARY_VERSION = 2;

function newTripId() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'trip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function hasOwn(obj, key) {
  return Boolean(obj && Object.prototype.hasOwnProperty.call(obj, key));
}

function isTripLibrary(value) {
  return Boolean(value && typeof value === 'object' && value.version === LIBRARY_VERSION && Array.isArray(value.trips));
}

function inferredDestinationFromTrip(t) {
  const hay = [
    ...(Array.isArray(t.anchors) ? t.anchors.map(a => [a.name, a.area, a.address].filter(Boolean).join(' ')) : []),
    ...(Array.isArray(t.flights) ? t.flights.map(f => [f.arriveAirport, f.arriveCity, f.departAirport, f.departCity].filter(Boolean).join(' ')) : []),
  ].join(' ').toLowerCase();
  if (/\bbroomfield\b/.test(hay)) return 'Broomfield, CO';
  if (/\bdenver\b|\bden\b/.test(hay)) return 'Denver, CO';
  return '';
}

function blankTrip() {
  return { id: newTripId(), destination: '', arrivalDate: '', nights: 0, anchors: [], prefs: [], anchoredPlaces: [], taste: { likes: [], dislikes: [] }, createdAt: Date.now() };
}

function ensureTrip(trip) {
  const t = trip && typeof trip === 'object' ? { ...trip } : blankTrip();
  if (!t.id) t.id = newTripId();
  if (typeof t.destination !== 'string') t.destination = '';
  t.destination = t.destination.trim();
  if (/^tokyo$/i.test(t.destination)) {
    const inferred = inferredDestinationFromTrip(t);
    if (inferred) t.destination = inferred;
  }
  if (!Array.isArray(t.anchors)) t.anchors = [];
  if (!Array.isArray(t.prefs)) t.prefs = [];
  if (!Array.isArray(t.anchoredPlaces)) t.anchoredPlaces = [];
  if (!t.taste || typeof t.taste !== 'object') t.taste = { likes: [], dislikes: [] };
  if (!Array.isArray(t.taste.likes)) t.taste.likes = [];
  if (!Array.isArray(t.taste.dislikes)) t.taste.dislikes = [];
  if (!t.createdAt) t.createdAt = Date.now();
  return t;
}

function toTripLibrary(value) {
  if (isTripLibrary(value)) {
    const trips = value.trips.map(ensureTrip);
    const activeTripId = trips.some(t => t.id === value.activeTripId) ? value.activeTripId : trips[0]?.id;
    return { version: LIBRARY_VERSION, activeTripId, trips, createdAt: value.createdAt || Date.now(), updatedAt: value.updatedAt || 0 };
  }
  const first = value && typeof value === 'object' ? ensureTrip(value) : blankTrip();
  return { version: LIBRARY_VERSION, activeTripId: first.id, trips: [first], createdAt: first.createdAt || Date.now(), updatedAt: first.updatedAt || 0 };
}

function maxTripUpdatedAt(library) {
  return Math.max(0, Number(library?.updatedAt) || 0, ...(Array.isArray(library?.trips) ? library.trips.map(t => Number(t.updatedAt) || 0) : []));
}

function itemKey(item, fields) {
  if (!item || typeof item !== 'object') return '';
  if (item.id) return 'id:' + String(item.id);
  const parts = fields.map(f => String(item[f] || '').trim().toLowerCase()).filter(Boolean);
  return parts.length ? parts.join('|') : '';
}

function flightKey(f) {
  return itemKey(f, ['flightNumber', 'departAt', 'arriveAt', 'departAirport', 'arriveAirport']);
}

function mergeArray(existing, incoming, keyFn, stale) {
  const oldArr = Array.isArray(existing) ? existing : [];
  const newArr = Array.isArray(incoming) ? incoming : [];
  if (!oldArr.length) return newArr;
  if (!newArr.length) return newArr;

  const out = oldArr.map(x => x && typeof x === 'object' ? { ...x } : x);
  const index = new Map();
  out.forEach((item, i) => {
    const key = keyFn(item);
    if (key) index.set(key, i);
  });

  for (const item of newArr) {
    const key = keyFn(item);
    const i = key ? index.get(key) : -1;
    if (i === undefined || i < 0) {
      out.push(item);
      if (key) index.set(key, out.length - 1);
    } else if (!stale) {
      out[i] = { ...out[i], ...item };
    } else {
      out[i] = { ...item, ...out[i] };
    }
  }
  return out;
}

function mergeObject(existing, incoming, stale) {
  const oldObj = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
  const newObj = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
  return stale ? { ...newObj, ...oldObj } : { ...oldObj, ...newObj };
}

function shouldPreserveField(existingTrip, incomingTrip, field, stale, alwaysWhenEmpty = false) {
  if (!hasOwn(incomingTrip, field)) return true;
  const existing = existingTrip[field];
  const incoming = incomingTrip[field];
  if (Array.isArray(existing) && existing.length && Array.isArray(incoming) && incoming.length === 0) {
    return stale || alwaysWhenEmpty;
  }
  if (existing && typeof existing === 'object' && !Array.isArray(existing) && incoming && typeof incoming === 'object' && !Array.isArray(incoming) && !Object.keys(incoming).length) {
    return stale;
  }
  return false;
}

function mergeTrip(existing, incoming, { stale }) {
  const oldTrip = ensureTrip(existing);
  const newTrip = ensureTrip(incoming);
  const deletedDocumentIds = mergeDeletedDocumentIds(oldTrip, newTrip);
  if (Array.isArray(oldTrip.documents)) oldTrip.documents = filterDeletedDocuments(oldTrip.documents, deletedDocumentIds);
  if (Array.isArray(newTrip.documents)) newTrip.documents = filterDeletedDocuments(newTrip.documents, deletedDocumentIds);
  const next = { ...oldTrip, ...newTrip };
  if (deletedDocumentIds.length) next.deletedDocumentIds = deletedDocumentIds;

  if ((!newTrip.destination || (/^tokyo$/i.test(newTrip.destination) && oldTrip.destination && !/^tokyo$/i.test(oldTrip.destination)))) {
    next.destination = oldTrip.destination;
  }

  const arrayRules = [
    ['flights', flightKey, true],
    ['travelInbox', x => itemKey(x, ['subject', 'receivedAt']), false],
    ['documents', x => itemKey(x, ['subject', 'receivedAt', 'title']), false],
    ['anchors', x => itemKey(x, ['name', 'confirmationNumber', 'address']), false],
    ['anchoredPlaces', x => String(x || ''), false],
    ['scratchpad', x => itemKey(x, ['sourceId', 'name', 'title']), false],
    ['discovered', x => itemKey(x, ['sourceId', 'name', 'title']), false],
    ['dismissedPlaces', x => String(x || ''), false],
  ];

  for (const [field, keyFn, alwaysWhenEmpty] of arrayRules) {
    if (shouldPreserveField(oldTrip, newTrip, field, stale, alwaysWhenEmpty)) next[field] = oldTrip[field];
    else if (Array.isArray(oldTrip[field]) && Array.isArray(newTrip[field])) next[field] = mergeArray(oldTrip[field], newTrip[field], keyFn, stale);
  }

  if (shouldPreserveField(oldTrip, newTrip, 'itinerary', stale)) next.itinerary = oldTrip.itinerary;
  else if (oldTrip.itinerary && newTrip.itinerary) next.itinerary = mergeObject(oldTrip.itinerary, newTrip.itinerary, stale);

  next.updatedAt = Math.max(Number(oldTrip.updatedAt) || 0, Number(newTrip.updatedAt) || 0);
  return ensureTrip(next);
}

function mergeDeletedDocumentIds(existingTrip, incomingTrip) {
  const out = new Set();
  const add = value => {
    if (typeof value === 'string') out.add(value);
    else if (value && typeof value === 'object' && value.id) out.add(String(value.id));
  };
  (Array.isArray(existingTrip?.deletedDocumentIds) ? existingTrip.deletedDocumentIds : []).forEach(add);
  (Array.isArray(existingTrip?.deletedDocuments) ? existingTrip.deletedDocuments : []).forEach(add);
  (Array.isArray(incomingTrip?.deletedDocumentIds) ? incomingTrip.deletedDocumentIds : []).forEach(add);
  (Array.isArray(incomingTrip?.deletedDocuments) ? incomingTrip.deletedDocuments : []).forEach(add);
  return [...out].filter(Boolean).slice(-200);
}

function filterDeletedDocuments(documents, deletedIds) {
  if (!Array.isArray(documents) || !deletedIds.length) return documents;
  const deleted = new Set(deletedIds);
  return documents.filter(doc => !doc?.id || !deleted.has(String(doc.id)));
}

export function mergeTripDataForSave(existingData, incomingData, { existingUpdatedAt = 0, now = Date.now() } = {}) {
  const incoming = toTripLibrary(incomingData);
  if (!existingData) return { ...incoming, updatedAt: now };

  const existing = toTripLibrary(existingData);
  const incomingUpdatedAt = maxTripUpdatedAt(incoming);
  const existingUpdated = Math.max(Number(existingUpdatedAt) || 0, maxTripUpdatedAt(existing));
  const stale = !incomingUpdatedAt || incomingUpdatedAt < existingUpdated;
  const existingById = new Map(existing.trips.map(t => [t.id, t]));
  const incomingIds = new Set(incoming.trips.map(t => t.id));
  const trips = incoming.trips.map(t => existingById.has(t.id) ? mergeTrip(existingById.get(t.id), t, { stale }) : ensureTrip(t));

  for (const t of existing.trips) {
    if (!incomingIds.has(t.id)) trips.push(t);
  }

  const activeTripId = trips.some(t => t.id === incoming.activeTripId)
    ? incoming.activeTripId
    : (trips.some(t => t.id === existing.activeTripId) ? existing.activeTripId : trips[0]?.id);

  return {
    version: LIBRARY_VERSION,
    activeTripId,
    trips,
    createdAt: existing.createdAt || incoming.createdAt || now,
    updatedAt: now,
  };
}
