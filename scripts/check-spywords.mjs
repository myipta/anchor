import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import anchor from '../worker.js';
import { handleSpyWordsRequest, validatePack } from '../functions/spywords-handler.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const BASE = 'https://anchor.example';
const token = 'LOCAL-TEST-TOKEN-NOT-A-REAL-SECRET';
const env = {
  ANTHROPIC_API_KEY: 'LOCAL-MOCK-KEY',
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

test('Quest planner uses existing authentication and provider without database writes', async () => {
  const payload = { text: 'Piano every day except summer', today: '2026-10-29', timezone: 'America/Los_Angeles', ledger: { routines: {}, assignments: {} } };
  const denied = await anchor.fetch(request('/spywords/v1/quests/plan', 'POST', payload, 'wrong'), env, {});
  assert.equal(denied.status, 401);
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).tool_choice.name, 'quest_plan');
    return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'quest_plan', input: { clarification: 'Which summer dates?', actions: [] } }] }), { status: 200 });
  };
  try {
    const response = await anchor.fetch(request('/spywords/v1/quests/plan', 'POST', payload), env, {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { clarification: 'Which summer dates?', actions: [] });
    assert.equal(calls, 1);
    const invalid = await anchor.fetch(request('/spywords/v1/quests/plan', 'POST', { ...payload, text: '' }), env, {});
    assert.equal(invalid.status, 400);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
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
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(opts.headers['x-api-key'], 'LOCAL-MOCK-KEY');
    const body=JSON.parse(opts.body);
    assert.equal(body.model, 'claude-sonnet-4-6');
    assert.equal(body.tool_choice.name, 'spy_word_pack');
    assert.deepEqual(JSON.parse(body.messages[0].content).parentSuppliedEntries?.map(x => x.lemma), ['astute']);
    return new Response(JSON.stringify({content:[{type:'tool_use',name:'spy_word_pack',
      input:{words:[{...word,definition:'an incorrect AI definition'}]}}]}), {status:200});
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


test('Uses DeepSeek with existing secret when explicitly selected', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async (url,opts) => {
    assert.equal(url,'https://api.deepseek.com/chat/completions');
    assert.equal(opts.headers.Authorization,'Bearer LOCAL-DEEPSEEK-KEY');
    const body=JSON.parse(opts.body);
    assert.equal(body.model,'deepseek-v4-pro');
    assert.equal(body.response_format.type,'json_object');
    assert.equal(body.thinking.type,'disabled');
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({words:[word]})}}]}),{status:200});
  };
  try {
    const settings={...env,SPYWORDS_AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'LOCAL-DEEPSEEK-KEY'};
    const result=await anchor.fetch(request('/spywords/v1/packs/generate','POST',
      {existingWords:[],count:1,requestedWords:['astute']}),settings,{});
    assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
    assert.equal((await result.json()).pack.words[0].lemma,'astute');
  } finally {globalThis.fetch=originalFetch;}
});

test('Falls back to existing DeepSeek key when Claude secret is not configured', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async (url) => {
    assert.equal(url,'https://api.deepseek.com/chat/completions');
    return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({words:[word]})}}]}),{status:200});
  };
  try {
    const settings={...env,ANTHROPIC_API_KEY:undefined,DEEPSEEK_API_KEY:'LOCAL-DEEPSEEK-KEY'};
    const response=await anchor.fetch(request('/spywords/v1/packs/generate','POST',
      {existingWords:[],count:1,requestedWords:['astute']}),settings,{});
    assert.equal(response.status,200);
  } finally {globalThis.fetch=originalFetch;}
});

test('Missing Claude and DeepSeek secrets returns 503 (but backup has its own D1 requirement)', async () => {
  const settings={...env,ANTHROPIC_API_KEY:undefined,DEEPSEEK_API_KEY:undefined};
  const response=await anchor.fetch(request('/spywords/v1/packs/generate','POST',
    {existingWords:[],count:1,requestedWords:['astute']}),settings,{});
  assert.equal(response.status,503);
});

test('Claude can generate a fresh clue using its required JSON tool', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async (url,opts) => {
    assert.equal(url,'https://api.anthropic.com/v1/messages');
    assert.equal(JSON.parse(opts.body).tool_choice.name,'spy_fresh_clues');
    return new Response(JSON.stringify({content:[{type:'tool_use',name:'spy_fresh_clues',
      input:{clues:[{id:'q1',sentence:'The ___ student noticed a detail everyone else missed in the ancient puzzle.'}]}}]}),{status:200});
  };
  try {
    const q={id:'q1',mode:'typed',lemma:'astute',definition:word.definition,answer:'astute',
      originalSentence:'The student was ___ when studying the clue.'};
    const r=await anchor.fetch(request('/spywords/v1/clues/remix','POST',{questions:[q]}),env,{});
    assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
    assert.deepEqual((await r.json()).clues.map(c=>c.id),['q1']);
  } finally {globalThis.fetch=originalFetch;}
});


test('12 parent-selected words generate in parallel groups of four without changing parent facts', async () => {
  const chosen = ['astute','benevolent','clandestine','dubious','ephemeral','furtive',
    'gregarious','haphazard','impetuous','judicious','kinetic','lethargic'];
  const originalFetch=globalThis.fetch;
  const batched=[];
  let concurrent=0, maxConcurrent=0;
  globalThis.fetch=async (url,opts) => {
    assert.equal(url,'https://api.anthropic.com/v1/messages');
    const body=JSON.parse(opts.body);
    const input=JSON.parse(body.messages[0].content);
    batched.push(input);
    concurrent++;
    maxConcurrent=Math.max(maxConcurrent,concurrent);
    await new Promise(resolve=>setTimeout(resolve,5));
    concurrent--;
    const words=input.requestedWords.map(lemma=>({
      ...word,lemma,inputAsTyped:lemma,definition:'incorrect model guess',
      items:{
        ...word.items,
        fillIn:{...word.items.fillIn,answer:lemma},
        typed:{...word.items.typed,answer:lemma}
      }
    }));
    return new Response(JSON.stringify({content:[{
      type:'tool_use',name:'spy_word_pack',input:{words}
    }]}),{status:200});
  };
  try {
    const sources=chosen.map(lemma=>({
      lemma,definition:'Parent definition of '+lemma,
      synonyms:['perceptive','observant'],antonyms:[],
      pronunciation:'',partOfSpeech:'adjective',memoryHook:'Parent mnemonic',
      watchOut:'',fillSentence:null,typedSentence:null,suppliedItems:null
    }));
    const result=await anchor.fetch(request('/spywords/v1/packs/generate','POST',{
      existingWords:[],requestedWords:chosen,sourceEntries:sources,count:12
    }),env,{});
    assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
    const data=await result.json();
    assert.equal(batched.length,3);
    assert.deepEqual(batched.map(b=>b.count),[4,4,4]);
    assert.deepEqual(batched.flatMap(b=>b.requestedWords),chosen);
    assert.deepEqual(batched.flatMap(b=>b.parentSuppliedEntries.map(x=>x.lemma)),chosen);
    assert.ok(maxConcurrent>1,'Expected overlapping provider requests');
    assert.deepEqual(data.pack.words.map(x=>x.lemma),chosen);
    assert.deepEqual(data.pack.words.map(x=>x.definition),sources.map(x=>x.definition));
    assert.ok(data.pack.words.every(x=>x.memoryHook==='Parent mnemonic'));
  } finally {globalThis.fetch=originalFetch;}
});

console.log('Anchor / Spy Words integration checks complete; no live paid model calls.');
