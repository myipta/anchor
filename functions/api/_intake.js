import { extractJson } from './_lib.js';
import { ensureSchema, isAllowed, normalizeEmail } from './_auth.js';
import { lookupPlace } from './_search.js';

const MAX_EMAIL_CHARS = 24000;
const INBOX_LIMIT = 20;
const FLIGHT_LIMIT = 30;

export async function readEmailMessage(message) {
  const raw = await new Response(message.raw).text();
  return parseRawEmail(raw, { from: message.from, to: message.to });
}

export function parseRawEmail(raw, defaults = {}) {
  const split = raw.search(/\r?\n\r?\n/);
  const head = split >= 0 ? raw.slice(0, split) : '';
  const body = split >= 0 ? raw.slice(split).replace(/^\r?\n\r?\n?/, '') : raw;
  const headers = parseHeaders(head);
  const contentType = headers['content-type'] || '';
  const transfer = headers['content-transfer-encoding'] || '';
  const subject = decodeMimeWords(headers.subject || '');
  const from = defaults.from || headers.from || '';
  const to = defaults.to || headers.to || '';
  const text = extractTextBody(body, contentType, transfer).slice(0, MAX_EMAIL_CHARS);
  return { raw, headers, subject, from, to, text };
}

export function emailAddress(value) {
  const s = String(value || '').trim();
  const m = s.match(/<([^>]+)>/) || s.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return normalizeEmail(m ? m[1] : s);
}

export async function userForInboundEmail(env, from) {
  await ensureSchema(env);
  const email = emailAddress(from);
  if (!email || !isAllowed(email, env)) return { error: 'sender_not_allowed', email };
  let user = await env.DB.prepare('SELECT id, email FROM users WHERE email=?').bind(email).first();
  if (!user) {
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO users (id, email, created_at) VALUES (?,?,?)').bind(id, email, Date.now()).run();
    user = { id, email };
  }
  return { user };
}

export async function ingestTravelEmail(env, user, { subject = '', text = '', from = '', receivedAt = Date.now() }) {
  await ensureSchema(env);
  const cleanText = String(text || '').replace(/\u0000/g, '').slice(0, MAX_EMAIL_CHARS);
  if (!cleanText.trim()) return { error: 'empty_email' };

  const extracted = await extractTravelInfo(env, { subject, text: cleanText, from });
  const row = await env.DB.prepare('SELECT id, data FROM trips WHERE user_id=?').bind(user.id).first();
  let stored = null;
  if (row) { try { stored = JSON.parse(row.data); } catch { stored = null; } }
  const library = toTripLibrary(stored);
  const activeTrip = activeTripFromLibrary(library);
  const before = summarizeTrip(activeTrip);
  const merged = await mergeTravelIntoTrip(env, activeTrip, extracted, { subject, from, receivedAt });
  const now = Date.now();
  merged.trip.updatedAt = now;
  const nextLibrary = { ...updateActiveTripInLibrary(library, merged.trip), updatedAt: now };
  const dataStr = JSON.stringify(nextLibrary);
  if (row) await env.DB.prepare('UPDATE trips SET data=?, updated_at=? WHERE user_id=?').bind(dataStr, now, user.id).run();
  else await env.DB.prepare('INSERT INTO trips (id, user_id, data, updated_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(), user.id, dataStr, now).run();

  return { ok: true, extracted, applied: merged.applied, before, after: summarizeTrip(merged.trip), updated_at: now };
}

async function extractTravelInfo(env, { subject, text, from }) {
  const fallback = fallbackExtract({ subject, text });
  if (!env.ANTHROPIC_API_KEY) return fallback;

  const system = 'You extract flight and hotel reservation facts from forwarded travel emails. Return ONLY valid JSON. Dates/times should be ISO-like strings when present. If a field is unknown, use an empty string or omit it. Do not invent facts.';
  const user = 'Return this JSON shape:\n' +
    '{"summary":"one short summary","hotel":{"name":"","address":"","area":"Tokyo neighborhood/city if clear","checkinDate":"YYYY-MM-DD","checkoutDate":"YYYY-MM-DD","confirmationNumber":""},"flights":[{"airline":"","flightNumber":"","confirmationNumber":"","departAirport":"IATA or airport name","departCity":"","departAt":"YYYY-MM-DDTHH:mm or date/time text","arriveAirport":"IATA or airport name","arriveCity":"","arriveAt":"YYYY-MM-DDTHH:mm or date/time text","terminal":"","seat":""}]}\n\n' +
    'From: ' + (from || '(unknown)') + '\nSubject: ' + (subject || '(none)') + '\nEmail text:\n' + text.slice(0, MAX_EMAIL_CHARS);
  const out = await callClaudeSonnet(env, { system, user, maxTokens: 1200 });
  if (out.error) return fallback;
  const parsed = extractJson(out.text);
  return normalizeExtracted(parsed, fallback);
}

async function callClaudeSonnet(env, { system, user, maxTokens = 1200 }) {
  const model = env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
  } catch (e) {
    return { error: 'fetch_failed', detail: String(e).slice(0, 300) };
  }
  if (!r.ok) return { error: 'anthropic_error', status: r.status, detail: (await r.text()).slice(0, 500) };
  const data = await r.json();
  const text = (data.content || []).map(part => part && part.type === 'text' ? part.text : '').join('').trim();
  return text ? { text, model } : { error: 'empty_response' };
}

function normalizeExtracted(parsed, fallback) {
  const p = parsed && typeof parsed === 'object' ? parsed : {};
  const hotel = p.hotel && typeof p.hotel === 'object' ? p.hotel : null;
  const flights = Array.isArray(p.flights) ? p.flights : [];
  const out = {
    summary: str(p.summary || fallback.summary, 180),
    hotel: hotel ? {
      name: str(hotel.name, 120),
      address: str(hotel.address, 220),
      area: str(hotel.area, 80),
      checkinDate: isoDate(hotel.checkinDate || hotel.checkInDate || hotel.checkin),
      checkoutDate: isoDate(hotel.checkoutDate || hotel.checkOutDate || hotel.checkout),
      confirmationNumber: str(hotel.confirmationNumber || hotel.confirmation || hotel.bookingReference, 80),
    } : fallback.hotel,
    flights: flights.map(f => ({
      airline: str(f.airline, 80),
      flightNumber: normalizeFlightNumber(f.flightNumber || f.flight),
      confirmationNumber: str(f.confirmationNumber || f.confirmation || f.recordLocator || f.bookingReference, 80),
      departAirport: str(f.departAirport || f.from || f.origin, 80),
      departCity: str(f.departCity, 80),
      departAt: str(f.departAt || f.departure || f.departureTime, 80),
      arriveAirport: str(f.arriveAirport || f.to || f.destination, 80),
      arriveCity: str(f.arriveCity, 80),
      arriveAt: str(f.arriveAt || f.arrival || f.arrivalTime, 80),
      terminal: str(f.terminal, 40),
      seat: str(f.seat, 30),
    })).filter(f => f.flightNumber || f.airline || f.departAirport || f.arriveAirport),
  };
  if ((!out.flights || !out.flights.length) && fallback.flights.length) out.flights = fallback.flights;
  if (!hasHotel(out.hotel) && hasHotel(fallback.hotel)) out.hotel = fallback.hotel;
  return out;
}

export async function mergeTravelIntoTrip(env, trip, extracted, meta) {
  const t = { ...trip };
  const applied = { hotel: false, flights: 0, inbox: true, detachedStops: 0 };
  const hotel = extracted.hotel || null;
  if (hasHotel(hotel)) {
    const anchors = Array.isArray(t.anchors) ? [...t.anchors] : [];
    const hotelName = str(hotel.name, 120);
    const hotelConf = str(hotel.confirmationNumber, 80);
    const matchIdx = findHotelAnchorIndex(anchors, hotelName, hotelConf);
    const existing = matchIdx >= 0 ? anchors[matchIdx] : { id: 'anc-' + Date.now(), name: 'My stay', area: 'Tokyo' };
    let enriched = null;
    if (env.GOOGLE_PLACES_API_KEY && hotel.name) enriched = await lookupPlace(env, hotel.name, hotel.area || existing.area || 'Tokyo');
    const checkin = isoDate(hotel.checkinDate) || existing.checkin || t.arrivalDate || '';
    const checkout = isoDate(hotel.checkoutDate) || existing.checkout || t.departureDate || '';
    const mergedAnchor = {
      ...existing,
      name: hotelName || existing.name,
      area: hotel.area || enriched?.area || existing.area || 'Tokyo',
      address: hotel.address || enriched?.address || existing.address || '',
      coords: enriched?.coords || existing.coords || '',
      googleUrl: enriched?.googleUrl || existing.googleUrl || '',
      checkin,
      checkout,
      confirmationNumber: hotelConf || existing.confirmationNumber || '',
      source: 'email',
    };
    if (matchIdx >= 0) anchors[matchIdx] = mergedAnchor;
    else anchors.push(mergedAnchor);
    t.anchors = anchors;
    if (checkin) t.arrivalDate = checkin;
    if (checkout) t.departureDate = checkout;
    const nights = dateDiff(checkin, checkout);
    if (nights > 0) t.nights = nights;
    applied.hotel = true;
  }

  const currentFlights = Array.isArray(t.flights) ? t.flights : [];
  const nextFlights = [...currentFlights];
  for (const f of (extracted.flights || [])) {
    const flight = normalizeFlight(f, meta.receivedAt);
    if (!flight) continue;
    const key = flightKey(flight);
    const idx = nextFlights.findIndex(x => flightKey(x) === key);
    if (idx >= 0) nextFlights[idx] = { ...nextFlights[idx], ...flight };
    else { nextFlights.push(flight); applied.flights++; }
  }
  if (nextFlights.length) {
    t.flights = nextFlights.sort((a, b) => String(a.departAt || '').localeCompare(String(b.departAt || ''))).slice(-FLIGHT_LIMIT);
    const firstArrival = t.flights.find(f => /tokyo|haneda|narita|hnd|nrt/i.test(String(f.arriveAirport || '') + ' ' + String(f.arriveCity || '')));
    const arrDate = isoDate(firstArrival?.arriveAt);
    if (arrDate && !t.arrivalDate) t.arrivalDate = arrDate;
  }

  if (applied.hotel || (extracted.flights || []).length) {
    applied.detachedStops = detachItineraryToAnchors(t);
  }

  const inbox = Array.isArray(t.travelInbox) ? t.travelInbox : [];
  t.travelInbox = [{
    id: 'mail-' + meta.receivedAt + '-' + Math.random().toString(36).slice(2, 7),
    receivedAt: meta.receivedAt,
    from: str(meta.from, 120),
    subject: str(meta.subject, 180),
    summary: extracted.summary || summaryFor(extracted),
    hotelUpdated: applied.hotel,
    flightsAdded: applied.flights,
    detachedStops: applied.detachedStops,
  }, ...inbox].slice(0, INBOX_LIMIT);

  return { trip: t, applied };
}

export function detachItineraryToAnchors(trip) {
  const itinerary = trip && typeof trip.itinerary === 'object' ? trip.itinerary : null;
  if (!itinerary) return 0;

  const curated = new Set(Array.isArray(trip.anchoredPlaces) ? trip.anchoredPlaces : []);
  const scratchIds = new Set();
  let count = 0;

  Object.values(itinerary).forEach(day => {
    if (!Array.isArray(day)) return;
    day.forEach(ref => {
      if (!ref || !ref.id) return;
      if (ref.kind === 'curated') { curated.add(ref.id); count++; }
      else if (ref.kind === 'scratch') { scratchIds.add(ref.id); count++; }
    });
  });

  if (!count) return 0;
  trip.anchoredPlaces = [...curated];
  if (scratchIds.size && Array.isArray(trip.scratchpad)) {
    trip.scratchpad = trip.scratchpad.map(item => scratchIds.has(item.id) ? { ...item, status: 'anchored' } : item);
  }
  trip.itinerary = {};
  return count;
}

function parseHeaders(head) {
  const headers = {};
  const lines = String(head || '').replace(/\r\n/g, '\n').split('\n');
  let key = '';
  for (const line of lines) {
    if (/^\s/.test(line) && key) headers[key] += ' ' + line.trim();
    else {
      const i = line.indexOf(':');
      if (i > 0) { key = line.slice(0, i).toLowerCase(); headers[key] = line.slice(i + 1).trim(); }
    }
  }
  return headers;
}

function extractTextBody(body, contentType, transfer) {
  const boundary = (contentType.match(/boundary="?([^";]+)"?/i) || [])[1];
  if (boundary) {
    const parts = String(body).split('--' + boundary);
    const decoded = parts.map(part => {
      const split = part.search(/\r?\n\r?\n/);
      if (split < 0) return '';
      const head = part.slice(0, split);
      const partBody = part.slice(split).replace(/^\r?\n\r?\n?/, '');
      const h = parseHeaders(head);
      const ct = h['content-type'] || '';
      if (!/text\/(plain|html)/i.test(ct)) return '';
      let txt = decodeTransfer(partBody, h['content-transfer-encoding'] || '');
      if (/text\/html/i.test(ct)) txt = htmlToText(txt);
      return txt;
    }).filter(Boolean);
    const plain = decoded.find(x => x.trim()) || '';
    if (plain) return plain;
  }
  let txt = decodeTransfer(body, transfer);
  if (/text\/html/i.test(contentType)) txt = htmlToText(txt);
  return txt;
}

function decodeTransfer(value, transfer) {
  const body = String(value || '').trim();
  if (/base64/i.test(transfer)) {
    try { return decodeURIComponent(escape(atob(body.replace(/\s+/g, '')))); } catch { return body; }
  }
  if (/quoted-printable/i.test(transfer)) return decodeQuotedPrintable(body);
  return body;
}

function decodeQuotedPrintable(value) {
  return String(value || '').replace(/=\r?\n/g, '').replace(/=([A-Fa-f0-9]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function decodeMimeWords(value) {
  return String(value || '').replace(/=\?([^?]+)\?([QB])\?([^?]*)\?=/gi, (_, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === 'B') return decodeURIComponent(escape(atob(text)));
      return decodeQuotedPrintable(text.replace(/_/g, ' '));
    } catch { return text; }
  });
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function fallbackExtract({ subject, text }) {
  const hay = String(subject || '') + '\n' + String(text || '');
  const flights = [...hay.matchAll(/\b([A-Z0-9]{2})\s?([0-9]{1,4}[A-Z]?)\b/g)]
    .map(m => ({ flightNumber: normalizeFlightNumber(m[1] + m[2]) }))
    .filter((f, i, arr) => f.flightNumber && arr.findIndex(x => x.flightNumber === f.flightNumber) === i)
    .slice(0, 6);
  const conf = (hay.match(/(?:confirmation|booking|reservation|record locator|pnr)[\s#:]*([A-Z0-9]{5,12})/i) || [])[1] || '';
  flights.forEach(f => { if (conf) f.confirmationNumber = conf; });
  const hotelName = (hay.match(/(?:hotel|stay|property)[:\s-]+([^\n]{4,90})/i) || [])[1] || '';
  return {
    summary: flights.length ? 'Imported ' + flights.length + ' flight' + (flights.length === 1 ? '' : 's') + '.' : (hotelName ? 'Imported hotel details.' : 'Imported travel email.'),
    hotel: hotelName ? { name: hotelName.trim(), confirmationNumber: conf } : null,
    flights,
  };
}

function normalizeFlight(f, receivedAt) {
  const flightNumber = normalizeFlightNumber(f.flightNumber);
  if (!flightNumber && !f.airline) return null;
  return {
    id: flightKey({ ...f, flightNumber }) || ('flight-' + receivedAt + '-' + Math.random().toString(36).slice(2, 7)),
    airline: str(f.airline, 80),
    flightNumber,
    confirmationNumber: str(f.confirmationNumber, 80),
    departAirport: str(f.departAirport, 80),
    departCity: str(f.departCity, 80),
    departAt: str(f.departAt, 80),
    arriveAirport: str(f.arriveAirport, 80),
    arriveCity: str(f.arriveCity, 80),
    arriveAt: str(f.arriveAt, 80),
    terminal: str(f.terminal, 40),
    seat: str(f.seat, 30),
    source: 'email',
    importedAt: receivedAt,
  };
}

function normalizeFlightNumber(value) {
  const s = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = s.match(/^([A-Z0-9]{2})([0-9]{1,4}[A-Z]?)$/);
  return m ? m[1] + ' ' + m[2] : str(value, 20).toUpperCase();
}

function flightKey(f) {
  return [normalizeFlightNumber(f.flightNumber), str(f.departAt, 32), str(f.departAirport, 16), str(f.arriveAirport, 16)].filter(Boolean).join('|').toLowerCase();
}

function findHotelAnchorIndex(anchors, name, confirmationNumber) {
  const targetName = normalizeName(name);
  const targetConf = normalizeName(confirmationNumber);
  if (targetConf) {
    const i = anchors.findIndex(a => normalizeName(a.confirmationNumber) === targetConf);
    if (i >= 0) return i;
  }
  if (targetName) {
    const i = anchors.findIndex(a => {
      const n = normalizeName(a.name);
      return n && (n === targetName || n.includes(targetName) || targetName.includes(n));
    });
    if (i >= 0) return i;
  }
  return -1;
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasHotel(hotel) {
  return Boolean(hotel && (hotel.name || hotel.address || hotel.checkinDate || hotel.checkoutDate));
}

function str(value, max = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isoDate(value) {
  const s = String(value || '').trim();
  const m = s.match(/(20\d{2})[-/\.](\d{1,2})[-/\.](\d{1,2})/);
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function dateDiff(from, to) {
  if (!from || !to) return 0;
  const a = new Date(from + 'T00:00:00');
  const b = new Date(to + 'T00:00:00');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

const LIBRARY_VERSION = 2;

function newTripId() {
  try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'trip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function isTripLibrary(value) {
  return Boolean(value && typeof value === 'object' && value.version === LIBRARY_VERSION && Array.isArray(value.trips));
}

function ensureTrip(trip) {
  const t = trip && typeof trip === 'object' ? { ...trip } : blankTrip();
  if (!t.id) t.id = newTripId();
  if (!t.destination) t.destination = 'Tokyo';
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

function activeTripFromLibrary(library) {
  const lib = toTripLibrary(library);
  return lib.trips.find(t => t.id === lib.activeTripId) || lib.trips[0] || blankTrip();
}

function updateActiveTripInLibrary(library, trip) {
  const lib = toTripLibrary(library);
  const next = ensureTrip({ ...trip, id: trip?.id || lib.activeTripId });
  const trips = lib.trips.some(t => t.id === next.id) ? lib.trips.map(t => t.id === next.id ? next : t) : [...lib.trips, next];
  return { ...lib, activeTripId: next.id, trips };
}

function blankTrip() {
  return { id: newTripId(), destination: 'Tokyo', arrivalDate: '', nights: 0, anchors: [], prefs: [], anchoredPlaces: [], taste: { likes: [], dislikes: [] }, createdAt: Date.now() };
}

function summarizeTrip(trip) {
  if (!trip) return null;
  return {
    arrivalDate: trip.arrivalDate || '',
    departureDate: trip.departureDate || '',
    nights: trip.nights || 0,
    hotel: trip.anchors?.[0]?.name || '',
    flights: Array.isArray(trip.flights) ? trip.flights.length : 0,
  };
}

function summaryFor(extracted) {
  if (hasHotel(extracted.hotel) && extracted.flights?.length) return 'Imported hotel and ' + extracted.flights.length + ' flight' + (extracted.flights.length === 1 ? '' : 's') + '.';
  if (hasHotel(extracted.hotel)) return 'Imported hotel details.';
  if (extracted.flights?.length) return 'Imported ' + extracted.flights.length + ' flight' + (extracted.flights.length === 1 ? '' : 's') + '.';
  return 'Imported travel email.';
}
