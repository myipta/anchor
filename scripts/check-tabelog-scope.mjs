import assert from 'node:assert/strict';
import { isJapanSearch } from '../functions/api/tabelog.js';

assert.equal(isJapanSearch({ destination: 'Tokyo', area: 'Shinjuku' }), true);
assert.equal(isJapanSearch({ destination: 'Broomfield, CO', area: 'Omni Interlocken' }), false);
assert.equal(isJapanSearch({ destination: 'Tokyo', area: 'Broomfield' }), false);
assert.equal(isJapanSearch({ destination: 'Denver', area: 'Colorado' }), false);

console.log('tabelog scope guardrails ok');
