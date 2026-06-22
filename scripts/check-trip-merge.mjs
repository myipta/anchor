import assert from 'node:assert/strict';
import { mergeTripDataForSave } from '../functions/api/trip.js';

const now = 2000;
const existing = {
  version: 2,
  activeTripId: 'tokyo',
  updatedAt: 1500,
  trips: [{
    id: 'tokyo',
    destination: 'Tokyo',
    arrivalDate: '2026-07-09',
    flights: [{ flightNumber: 'NH 870', arriveAirport: 'HND', arriveAt: '2026-07-09T20:00', gate: '61' }],
    documents: [{ id: 'doc-1', subject: 'Conference packet', receivedAt: 1000 }],
    travelInbox: [{ id: 'mail-1', subject: 'ANA itinerary', receivedAt: 900 }],
  }, {
    id: 'denver',
    destination: 'Broomfield, CO',
    anchors: [{ name: 'Omni Interlocken', area: 'Broomfield' }],
  }],
};

const staleLegacy = {
  id: 'tokyo',
  destination: 'Tokyo',
  arrivalDate: '2026-07-09',
  anchors: [],
  prefs: [],
  anchoredPlaces: [],
  taste: { likes: [], dislikes: [] },
};

const protectedSave = mergeTripDataForSave(existing, staleLegacy, { existingUpdatedAt: 1600, now });
assert.equal(protectedSave.version, 2);
assert.equal(protectedSave.trips.length, 2);
assert.equal(protectedSave.trips.find(t => t.id === 'tokyo').flights.length, 1);
assert.equal(protectedSave.trips.find(t => t.id === 'tokyo').documents.length, 1);
assert.equal(protectedSave.trips.find(t => t.id === 'tokyo').travelInbox.length, 1);
assert.equal(protectedSave.trips.find(t => t.id === 'denver').destination, 'Broomfield, CO');

const documentDelete = mergeTripDataForSave(existing, {
  version: 2,
  activeTripId: 'tokyo',
  updatedAt: 1700,
  trips: [{ ...existing.trips[0], updatedAt: 1700, documents: [] }],
}, { existingUpdatedAt: 1600, now });
assert.equal(documentDelete.trips.find(t => t.id === 'tokyo').documents.length, 0);
assert.equal(documentDelete.trips.find(t => t.id === 'tokyo').flights.length, 1);

const missingFlightsCurrentClient = mergeTripDataForSave(existing, {
  version: 2,
  activeTripId: 'tokyo',
  updatedAt: 1800,
  trips: [{ id: 'tokyo', destination: 'Tokyo', updatedAt: 1800, documents: [] }],
}, { existingUpdatedAt: 1600, now });
assert.equal(missingFlightsCurrentClient.trips.find(t => t.id === 'tokyo').flights.length, 1);

const deletedDocStaysDeleted = mergeTripDataForSave({
  version: 2,
  activeTripId: 'tokyo',
  updatedAt: 1900,
  trips: [{ ...existing.trips[0], documents: [], deletedDocumentIds: ['doc-1'], updatedAt: 1900 }],
}, {
  version: 2,
  activeTripId: 'tokyo',
  updatedAt: 1500,
  trips: [{ ...existing.trips[0], updatedAt: 1500 }],
}, { existingUpdatedAt: 1900, now });
assert.equal(deletedDocStaysDeleted.trips.find(t => t.id === 'tokyo').documents.length, 0);
assert.deepEqual(deletedDocStaysDeleted.trips.find(t => t.id === 'tokyo').deletedDocumentIds, ['doc-1']);

console.log('trip merge guardrails ok');
