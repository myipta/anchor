import assert from 'node:assert/strict';
import { blankTrip, createTripFrom, ensureTrip, toTripLibrary, tripTitle } from '../src/state/trip.js';

const denver = createTripFrom(null, blankTrip({ destination: 'Tokyo', prefs: ['coffee'], taste: { likes: ['quiet'], dislikes: [] } }), { destination: 'Broomfield, CO' });
const active = denver.trips.find(t => t.id === denver.activeTripId);
assert.equal(active.destination, 'Broomfield, CO');
assert.equal(tripTitle(active), 'Broomfield, CO');

const preserved = ensureTrip({ id: 'trip-den', destination: 'Denver', arrivalDate: '2026-06-22' });
assert.equal(preserved.destination, 'Denver');

const missing = ensureTrip({ id: 'trip-empty', arrivalDate: '2026-06-22' });
assert.equal(missing.destination, '');
assert.equal(tripTitle(missing), 'Trip · 2026-06-22');

const lib = toTripLibrary({ version: 2, activeTripId: 'trip-broomfield', trips: [{ id: 'trip-broomfield', destination: 'Broomfield, CO', arrivalDate: '2026-06-22' }] });
assert.equal(lib.trips[0].destination, 'Broomfield, CO');

const repaired = ensureTrip({ id: 'trip-corrupt', destination: 'Tokyo', anchors: [{ name: 'Omni Interlocken', area: 'Broomfield, CO' }] });
assert.equal(repaired.destination, 'Broomfield, CO');
const repairedFlight = ensureTrip({ id: 'trip-den-flight', destination: 'Tokyo', flights: [{ arriveAirport: 'DEN', arriveAt: '2026-06-22T14:40' }] });
assert.equal(repairedFlight.destination, 'Denver, CO');

console.log('trip state guardrails ok');
