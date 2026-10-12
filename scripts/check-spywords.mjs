import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import anchor from '../worker.js';
import { handleSpyWordsRequest, validatePack } from '../functions/spywords-handler.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const BASE = 'https://anchor.example';
const token = 'LOCAL-TEST-TOKEN-NOT-A-REAL-SECRET';
const env = {
  OPENAI_API_KEY: 'LOCAL-MOCK-KEY',
  SPYWORDS_BRIDGE_TOKEN: token,
  LIMIT_PER_HOUR: '100',
  ASSETS: { fetch: async () => new Response('Anchor frontend asset', { status: 200 }) },
};
const request = (path, method = 'GET', data, authorization = token) =>
  new Request(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: 'Bearer ' + authorization } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });

test('Spy Words routes do not hijack Anchor routes or frontend assets', async () => {
  assert.equal(await handleSpyWordsRequest(request('/api/health'), env), null);
  const normal = await anchor.fetch(request('/'), env, {});
  assert.equal(await normal.text(), 'Anchor frontend asset');
  const health = await anchor.fetch(request('/api/health'), env, {});
  assert.equal(health.status, 200);
  assert.equal((await health.json()).service, 'anchor-api');
  assert.equal(typeof anchor.email, 'function');
});

test('Spy Words health works through the real Anchor Worker entry', async () => {
  const response = await anchor.fetch(request('/spywords/health'), env, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('New AI routes refuse missing or invalid bridge token', async () => {
  const body = { existingWords: [], count: 1, requestedWords: ['astute'] };
  for (const t of [null, 'not-the-token']) {
    const response = await anchor.fetch(request('/spywords/v1/packs/generate', 'POST', body, t), env, {});
    assert.equal(response.status, 401);
  }
});

test('Malformed generation input rejected without a provider call', async () => {
  const response = await anchor.fetch(request('/spywords/v1/packs/generate', 'POST',
    { existingWords: [], count: 2, requestedWords: ['astute','astute'] }), env, {});
  assert.equal(response.status, 400);
});

const word = {
  lemma: 'astute', inputAsTyped: 'astute', pronunciation: 'uh-STOOT',
  partOfSpeech: 'adjective', definition: 'quick to notice and understand details',
  synonyms: ['perceptive', 'observant'], antonyms: ['unaware'],
  memoryHook: 'An astute spy notices subtle clues.',
  watchOut: 'Describes sharp insight, not simply being smart.',
  flags: [],
  items: {
    fillIn: {
      sentence: 'The ___ agent spotted a secret mark hidden underneath the painted doorway.',
      answer: 'astute',
      decoys: [
        { text: 'careless', meaning: 'not paying attention' },
        { text: 'sleepy', meaning: 'needing sleep' },
        { text: 'confused', meaning: 'unable to understand' },
      ],
    },
    synonym: {
      acceptedAnswers: ['perceptive'],
      decoys: [
        { text: 'oblivious', meaning: 'unaware' },
        { text: 'distracted', meaning: 'unable to concentrate' },
        { text: 'clumsy', meaning: 'awkward' },
      ],
    },
    typed: {
      sentence: 'The detective was ___ enough to spot the hidden message behind the old painting.',
      answer: 'astute', formHint: null,
    },
  },
};

test('Parent vocabulary facts are preserved when AI generates exercises', async () => {
  assert.equal(validatePack([word], [], 1), true);
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(opts.headers.Authorization, 'Bearer LOCAL-MOCK-KEY');
    return new Response(JSON.stringify({ output: [{ content: [{
      type: 'output_text',
      text: JSON.stringify({ words: [{ ...word, definition: 'an incorrect AI definition' }] }),
    }] }] }), { status: 200 });
  };
  const source = {
    lemma: 'astute',
    definition: word.definition,
    synonyms: word.synonyms,
    antonyms: word.antonyms,
    pronunciation: word.pronunciation,
    partOfSpeech: word.partOfSpeech,
    memoryHook: word.memoryHook,
    watchOut: word.watchOut,
    fillSentence: null,
    typedSentence: null,
    suppliedItems: null,
  };
  try {
    const response = await anchor.fetch(request('/spywords/v1/packs/generate', 'POST', {
      existingWords: [], count: 1, requestedWords: ['astute'], sourceEntries: [source],
    }), env, {});
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    const result = await response.json();
    assert.equal(result.pack.words[0].definition, word.definition);
    assert.deepEqual(result.pack.words[0].synonyms, word.synonyms);
  } finally {
    globalThis.fetch = savedFetch;
  }
});

console.log('Anchor / Spy Words integration checks complete; no live paid model calls.');
