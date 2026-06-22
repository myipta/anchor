import assert from 'node:assert/strict';
import { fallbackDocumentInfo, hasDocumentSaveRequest, hasUsefulTravelFacts, isUsefulDocumentInfo, parseRawEmail, targetFromText } from '../functions/api/_intake.js';

assert.equal(hasUsefulTravelFacts({ summary: 'No travel facts found.', hotel: null, flights: [] }), false);
assert.equal(hasUsefulTravelFacts({ hotel: { checkinDate: '2026-07-10' }, flights: [] }), false);
assert.equal(hasUsefulTravelFacts({ hotel: { name: 'Hotel Okura Tokyo', checkinDate: '2026-07-10' }, flights: [] }), true);
assert.equal(hasUsefulTravelFacts({ flights: [{ flightNumber: 'JL 5' }] }), false);
assert.equal(hasUsefulTravelFacts({ flights: [{ flightNumber: 'JL 5', arriveAirport: 'HND', arriveAt: '2026-07-10T14:40' }] }), true);

assert.equal(isUsefulDocumentInfo({ saveDocument: true, title: 'dummy', cleanText: 'save this for the trip on July 10\nrandom dummy email' }), false);
assert.equal(isUsefulDocumentInfo({ saveDocument: true, title: 'Conference agenda', cleanText: 'Day 1 keynote starts at 9 AM in Hall A. Badge pickup opens at 8 AM, workshop rooms are on level 3, and the offsite dinner bus leaves at 6 PM.' }), true);
assert.equal(hasDocumentSaveRequest({ subject: 'Conference packet', text: 'documents for trip on 6/22-6/26\nDay 1 keynote starts at 9 AM in Hall A. Badge pickup opens at 8 AM, workshop rooms are on level 3, and dinner bus leaves at 6 PM.' }), true);
assert.equal(targetFromText('documents for trip on 6/22-6/26').date, new Date().getFullYear() + '-06-22');
const doc = fallbackDocumentInfo({ subject: 'Conference packet', text: 'documents for trip on 6/22-6/26\nDay 1 keynote starts at 9 AM in Hall A. Badge pickup opens at 8 AM, workshop rooms are on level 3, and dinner bus leaves at 6 PM.' });
assert.equal(doc.target.date, new Date().getFullYear() + '-06-22');
assert.equal(doc.cleanText.includes('documents for trip'), false);
const pdfRaw = [
  'From: Matthew <matthew.yip2011@gmail.com>',
  'To: trips@mattyip.dev',
  'Subject: Conference PDF',
  'Content-Type: multipart/mixed; boundary="abc"',
  '',
  '--abc',
  'Content-Type: text/plain',
  '',
  'documents for trip on 6/22-6/26',
  '--abc',
  'Content-Type: application/pdf; name="agenda.pdf"',
  'Content-Disposition: attachment; filename="agenda.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQKJUVPRg==',
  '--abc--',
  '',
].join('\r\n');
const parsed = parseRawEmail(pdfRaw);
assert.equal(parsed.attachments.length, 1);
assert.equal(parsed.attachments[0].name, 'agenda.pdf');
assert.equal(parsed.attachments[0].dataUrl.startsWith('data:application/pdf;base64,'), true);
assert.equal(isUsefulDocumentInfo({ saveDocument: true, attachments: parsed.attachments, cleanText: '' }), true);

console.log('intake guardrails ok');
