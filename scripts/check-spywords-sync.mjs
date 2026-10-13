import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import { handleSpyWordsRequest } from '../functions/spywords-handler.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

class MemoryD1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) {
    const statement = this.db.prepare(sql);
    return { sql, args: [], bind(...args) { this.args = args; return this; },
      run() { return statement.run(...this.args); },
      all() { return { results: statement.all(...this.args) }; } };
  }
  async batch(statements) {
    this.db.exec('BEGIN');
    try {
      const results = statements.map(s => (/^\s*SELECT\b/i.test(s.sql)
        ? s.all() : (s.run(), { results: [] })));
      this.db.exec('COMMIT');
      return results;
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
}
const env = {DB:new MemoryD1(), SPYWORDS_BRIDGE_TOKEN:'TEST-ONLY-SHARED-FAMILY-TOKEN'};
const word = (lemma) => ({
  lemma, inputAsTyped: lemma, pronunciation:'example', partOfSpeech:'adjective',
  definition:'quick and careful with clues', synonyms:['observant','alert'], antonyms:['unaware'],
  memoryHook:'A careful agent spots details', watchOut:'Read context carefully', flags:[],
  items: {
    fillIn: {sentence:'The ___ agent noticed the tiny clue hidden underneath the ancient painting.', answer:lemma,
      decoys:[{text:'sleepy',meaning:'tired'},{text:'careless',meaning:'not careful'},{text:'confused',meaning:'unsure'}]},
    synonym: {acceptedAnswers:['observant'],decoys:[{text:'clumsy',meaning:'awkward'},{text:'lazy',meaning:'not hardworking'},{text:'oblivious',meaning:'unaware'}]},
    typed: {sentence:'Even the most ___ detective would have searched behind the old mysterious painting.',answer:lemma,formHint:null}
  }
});
const seed = {packs:[{words:[word('astute'),word('perceptive')]}]};
const pack=(id,n) => ({...seed.packs[0], id:`custom-${id}`, title:`Test pack ${n}`,source:'local test',trapWords:[],status:'approved',words:[seed.packs[0].words[n]]});
const profile = {agentName:'Jacob',xp:10,totalAnswered:1,totalCorrect:1,dailyStreak:1,lastActiveDate:null,wordProgress:{},sessionHistory:[]};
const api=(method='GET',payload,token=env.SPYWORDS_BRIDGE_TOKEN,localEnv=env)=>handleSpyWordsRequest(new Request('https://anchor.example/spywords/v1/sync',{method,headers:{Authorization:`Bearer ${token}`,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})}),localEnv);

test('sync requires a separate bearer token and no D1 access before authentication',async()=>{
  assert.equal((await api('GET',null,'wrong')).status,401);
  assert.equal((await api('GET',null,env.SPYWORDS_BRIDGE_TOKEN,{SPYWORDS_BRIDGE_TOKEN:env.SPYWORDS_BRIDGE_TOKEN})).status,503);
});
test('empty first-device sync initializes cloud and backs up approved words',async()=>{
  const initial=await api();assert.equal(initial.status,200);
  assert.deepEqual((await initial.json()).packs,[]);
  const saved=await api('POST',{deviceId:'phone-alpha',packs:[pack('alpha-111111',0)],profile});
  assert.equal(saved.status,200,JSON.stringify(await saved.clone().json()));
  const snapshot=await saved.json();
  assert.equal(snapshot.packs.length,1);
  assert.equal(snapshot.packs[0].words[0].lemma,seed.packs[0].words[0].lemma);
  assert.equal(snapshot.profiles.length,1);
});
test('fresh second device cannot overwrite cloud backup with an empty pack list',async()=>{
  const incoming=await api('POST',{deviceId:'phone-bravo',packs:[],profile});
  assert.equal(incoming.status,200);
  const snapshot=await incoming.json();
  assert.equal(snapshot.packs.length,1);
  assert.equal(snapshot.profiles.length,2);
});
test('sync is repeatable and an additional phone pack is unioned',async()=>{
  const firstPack=pack('alpha-111111',0);
  await api('POST',{deviceId:'phone-alpha',packs:[firstPack],profile});
  const incoming=await api('POST',{deviceId:'phone-bravo',packs:[pack('bravo-222222',1)],profile});
  const snapshot=await incoming.json();
  assert.equal(snapshot.packs.length,2);
  assert.equal(new Set(snapshot.packs.map(p=>p.id)).size,2);
  assert.equal((await (await api()).json()).packs.length,2);
});
test('invalid data or missing token cannot erase previously backed up packs',async()=>{
  const invalid=await api('POST',{deviceId:'phone-bravo',packs:[{id:'bad',status:'approved'}],profile});
  assert.equal(invalid.status,400);
  const unauthorized=await api('POST',{deviceId:'phone-bad',packs:[],profile},'nope');
  assert.equal(unauthorized.status,401);
  assert.equal((await (await api()).json()).packs.length,2);
});
test('same pack ID cannot silently overwrite existing content',async()=>{
  const replacement={...pack('alpha-111111',0),title:'Changed malicious replacement'};
  const response=await api('POST',{deviceId:'phone-alpha',packs:[replacement],profile});
  assert.equal(response.status,200);
  const snapshot=await response.json();
  assert.notEqual(snapshot.packs.find(p=>p.id===replacement.id).title,replacement.title);
});
