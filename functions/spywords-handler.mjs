/**
 * Spy Words routes for an EXISTING Cloudflare Worker.
 * No Node.js modules, no additional dependencies, and no OpenAI key in iOS.
 * Integrate in that Worker's fetch handler using handleSpyWordsRequest().
 * Routes live under /spywords/ to avoid interfering with existing Worker routes.
 */
import { handleSpyWordsSync } from './spywords-sync.mjs';
import { questPlanRequest, validateQuestProposal } from './quest-planner.mjs';

const MAX_BODY = 64 * 1024;
const limits = new Map(); // per-isolate safety guard, NOT a durable global rate limit.

const nonempty = s => typeof s === 'string' && s.trim().length > 0;
const unique = entries => new Set(entries.map(x => x.trim().toLowerCase())).size === entries.length;
const exactlyOneBlank = (s, answer) =>
    nonempty(s) && typeof answer === 'string' && answer.trim().length >= 2 &&
    s.length >= 25 && s.length <= 270 && s.split('___').length === 2 &&
    !(new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')).test(s);

export function validatePack(words, knownWords = [], expectedCount = 12) {
    if (!Array.isArray(words) || words.length !== expectedCount || expectedCount < 1 || expectedCount > 12) return false;
    const known = new Set(knownWords.map(x => String(x).trim().toLowerCase()));
    const spellings = words.map(w => w?.lemma || '');
    if (!unique(spellings)) return false;
    return words.every(w => {
        if (!w || !/^[a-z][a-z-]{2,24}$/i.test(w.lemma) || known.has(w.lemma.toLowerCase())) return false;
        if (!nonempty(w.inputAsTyped) || !nonempty(w.pronunciation) || !nonempty(w.partOfSpeech) ||
            !nonempty(w.definition) || !nonempty(w.memoryHook) || !nonempty(w.watchOut) ||
            !Array.isArray(w.synonyms) || !w.synonyms.length || !Array.isArray(w.antonyms) ||
            !Array.isArray(w.flags)) return false;
        const fill = w.items?.fillIn, syn = w.items?.synonym, typed = w.items?.typed;
        if (!fill || !syn || !typed || !exactlyOneBlank(fill.sentence, fill.answer) ||
            !exactlyOneBlank(typed.sentence, typed.answer)) return false;
        if (!Array.isArray(fill.decoys) || fill.decoys.length !== 3 ||
            !Array.isArray(syn.decoys) || syn.decoys.length !== 3 ||
            !Array.isArray(syn.acceptedAnswers) || !syn.acceptedAnswers.length) return false;
        const checkOptions = (answer, decoys) => unique([answer, ...decoys.map(d => d?.text || '')]) &&
            decoys.every(d => nonempty(d?.text) && nonempty(d?.meaning));
        if (!checkOptions(fill.answer, fill.decoys) || !checkOptions(syn.acceptedAnswers[0], syn.decoys)) return false;
        if (!syn.acceptedAnswers.every(a => w.synonyms.some(s => s.toLowerCase() === a.toLowerCase()))) return false;
        return true;
    });
}

export function validateFreshClues(clues, questions) {
    if (!Array.isArray(clues) || !Array.isArray(questions)) return [];
    const allowed = new Map(questions.map(q => [q.id, q]));
    const seen = new Set();
    return clues.filter(c => {
        const q = allowed.get(c?.id);
        if (!q || seen.has(c.id) || !['fillIn','typed'].includes(q.mode) ||
            !exactlyOneBlank(c.sentence, q.answer)) return false;
        seen.add(c.id);
        return true;
    });
}

const decoySchema = {type:'object',additionalProperties:false,properties:{text:{type:'string'},meaning:{type:'string'}},required:['text','meaning']};
const packWordSchema = {
    type:'object', additionalProperties:false,
    properties:{
        lemma:{type:'string'},inputAsTyped:{type:'string'},pronunciation:{type:'string'},
        partOfSpeech:{type:'string'},definition:{type:'string'},synonyms:{type:'array',items:{type:'string'}},
        antonyms:{type:'array',items:{type:'string'}},memoryHook:{type:'string'},watchOut:{type:'string'},
        flags:{type:'array',items:{type:'string'}},
        items:{type:'object',additionalProperties:false,properties:{
            fillIn:{type:'object',additionalProperties:false,properties:{sentence:{type:'string'},answer:{type:'string'},decoys:{type:'array',items:decoySchema}},required:['sentence','answer','decoys']},
            synonym:{type:'object',additionalProperties:false,properties:{acceptedAnswers:{type:'array',items:{type:'string'}},decoys:{type:'array',items:decoySchema}},required:['acceptedAnswers','decoys']},
            typed:{type:'object',additionalProperties:false,properties:{sentence:{type:'string'},answer:{type:'string'},formHint:{type:['string','null']}},required:['sentence','answer','formHint']}
        },required:['fillIn','synonym','typed']}
    },
    required:['lemma','inputAsTyped','pronunciation','partOfSpeech','definition','synonyms','antonyms','memoryHook','watchOut','flags','items']
};
const packSchema = {type:'object',additionalProperties:false,properties:{words:{type:'array',items:packWordSchema}},required:['words']};
const clueSchema = {type:'object',additionalProperties:false,properties:{clues:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},sentence:{type:'string'}},required:['id','sentence']}}},required:['clues']};


// Workers receive secrets as env bindings; do not deploy the key in source or vars.
function selectProvider(env) {
    // Default to Claude; use DeepSeek when Claude is not bound.
    // An explicitly configured provider never silently falls back.
    const selected = String(env.SPYWORDS_AI_PROVIDER || '').trim().toLowerCase();
    if (selected && !['claude', 'deepseek'].includes(selected))
        throw Object.assign(new Error('Invalid SPYWORDS_AI_PROVIDER setting'), {status:503});
    const provider = selected || (env.ANTHROPIC_API_KEY ? 'claude' : 'deepseek');
    const key = provider === 'claude' ? env.ANTHROPIC_API_KEY : env.DEEPSEEK_API_KEY;
    if (!key) throw Object.assign(new Error('No configured AI provider for Spy Words'), {status:503});
    return {provider, key};
}

// Keys remain encrypted Worker secrets and are never sent to iOS.
async function providerJSON(env, { instructions, input, schema, schemaName, maxTokens }) {
    const {provider, key} = selectProvider(env);
    let response;
    if (provider === 'claude') {
        response = await fetch('https://api.anthropic.com/v1/messages', {
            method:'POST',
            headers:{
                'x-api-key':key,
                'anthropic-version':'2023-06-01',
                'Content-Type':'application/json'
            },
            body:JSON.stringify({
                model: env.SPYWORDS_CLAUDE_MODEL || env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
                max_tokens:maxTokens,
                system:instructions,
                messages:[{role:'user',content:input}],
                tools:[{name:schemaName,description:'Return Spy Words structured study material',input_schema:schema}],
                tool_choice:{type:'tool',name:schemaName,disable_parallel_tool_use:true}
            }),
            signal:AbortSignal.timeout(90000)
        });
    } else {
        response = await fetch('https://api.deepseek.com/chat/completions', {
            method:'POST',
            headers:{Authorization:'Bearer ' + key,'Content-Type':'application/json'},
            body:JSON.stringify({
                model:env.SPYWORDS_DEEPSEEK_MODEL || env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
                messages:[
                    {role:'system',content:instructions + '\nReturn a JSON object only. It must conform to this JSON schema: ' + JSON.stringify(schema)},
                    {role:'user',content:input}
                ],
                response_format:{type:'json_object'},
                thinking:{type:'disabled'},
                max_tokens:maxTokens,
                stream:false
            }),
            signal:AbortSignal.timeout(90000)
        });
    }
    if (!response.ok) {
        // Never send upstream response bodies or credentials to the app.
        console.error('Spy Words AI provider failed:',provider,response.status);
        throw Object.assign(new Error('The AI provider is temporarily unavailable'),{status:502});
    }
    let output;
    try {
        const data = await response.json();
        if (provider === 'claude') {
            output = data.content?.find(b => b.type === 'tool_use' && b.name === schemaName)?.input;
        } else {
            const raw = data.choices?.[0]?.message?.content;
            output = typeof raw === 'string' ? JSON.parse(raw) : null;
        }
    } catch {
        throw Object.assign(new Error('The AI provider did not return valid JSON'),{status:502});
    }
    if (!output || typeof output !== 'object' || Array.isArray(output))
        throw Object.assign(new Error('The AI provider returned no usable study content'),{status:502});
    return output;
}

function json(status, data, allowedOrigin = '') {
    const headers = {'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    if (allowedOrigin) {headers['Access-Control-Allow-Origin']=allowedOrigin;headers['Vary']='Origin';}
    return new Response(JSON.stringify(data), {status,headers});
}

async function authorized(request, env) {
    const token = env.SPYWORDS_BRIDGE_TOKEN || '';
    const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('Authorization') || '');
    if (!token || !match) return false;
    // Fixed-length digest comparison instead of timing-dependent plaintext compare.
    const encoder = new TextEncoder();
    const hashes = await Promise.all([token,match[1]].map(s => crypto.subtle.digest('SHA-256',encoder.encode(s))));
    const a = new Uint8Array(hashes[0]), b = new Uint8Array(hashes[1]);
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
    return difference === 0;
}

function allowedCall(env) {
    const hour = Math.floor(Date.now()/3600000);
    for (const key of limits.keys()) if (key !== hour) limits.delete(key);
    const limit = Math.max(1, Math.min(100, Number(env.LIMIT_PER_HOUR || 20) || 20));
    const n = limits.get(hour) || 0;
    if (n >= limit) return false;
    limits.set(hour,n+1);
    return true;
}

async function readJSON(request, maxBytes = MAX_BODY) {
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))
        throw Object.assign(new Error('Content-Type must be application/json'),{status:415});
    const reader = request.body?.getReader();
    if (!reader) throw Object.assign(new Error('Missing request body'),{status:400});
    const chunks=[]; let total=0;
    try {
        while(true) {
            const {done,value} = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maxBytes) throw Object.assign(new Error('Request is too large'),{status:413});
            chunks.push(value);
        }
    } finally {reader.releaseLock();}
    const body = new Uint8Array(total); let offset=0;
    for(const chunk of chunks) {body.set(chunk,offset);offset+=chunk.byteLength;}
    try {return JSON.parse(new TextDecoder().decode(body));}
    catch {throw Object.assign(new Error('Invalid JSON request'),{status:400});}
}

/**
 * Invoke at the top of an existing Cloudflare Worker's `fetch(request, env, ctx)`.
 * Returns null for unrelated routes, so existing behavior is preserved.
 * App setting: https://YOUR-WORKER.workers.dev/spywords
 */
export async function handleSpyWordsRequest(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/spywords/')) return null;
    const allowedOrigin = env.SPYWORDS_ALLOWED_ORIGIN && request.headers.get('Origin') === env.SPYWORDS_ALLOWED_ORIGIN
        ? env.SPYWORDS_ALLOWED_ORIGIN : '';
    const send = (status,data) => json(status,data,allowedOrigin);
    try {
        if (request.method === 'OPTIONS') {
            if (!allowedOrigin) return send(403,{error:'Origin not allowed'});
            return new Response(null,{status:204,headers:{
                'Access-Control-Allow-Origin':allowedOrigin,
                'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers':'Authorization, Content-Type',
                'Access-Control-Max-Age':'300','Vary':'Origin'}});
        }
        if (request.method === 'GET' && path === '/spywords/health') return send(200,{status:'ok'});
        if (path === '/spywords/v1/sync') {
            if (!(await authorized(request, env))) return send(401,{error:'Unauthorized bridge token'});
            return await handleSpyWordsSync(request, env, {readJSON, validatePack, send});
        }
        if (request.method !== 'POST' || !['/spywords/v1/packs/generate','/spywords/v1/clues/remix','/spywords/v1/quests/plan'].includes(path))
            return send(404,{error:'Not found'});
        if (!(await authorized(request, env))) return send(401,{error:'Unauthorized bridge token'});
        if (!allowedCall(env)) return send(429,{error:'AI request limit reached. Try again later.'});
        const body = await readJSON(request);
        if (path === '/spywords/v1/quests/plan') {
            return send(200, validateQuestProposal(await providerJSON(env, questPlanRequest(body))));
        }
        if (path === '/spywords/v1/packs/generate') {
            const existing=body?.existingWords;
            const count=body?.count;
            const requested=body?.requestedWords;
            const sourceEntries=body?.sourceEntries;
            const validSources = sourceEntries === undefined ||
                (Array.isArray(sourceEntries) && sourceEntries.length === count &&
                 Array.isArray(requested) && sourceEntries.every((entry, i) =>
                    entry && entry.lemma === requested[i] &&
                    nonempty(entry.definition) && entry.definition.length <= 350 &&
                    Array.isArray(entry.synonyms) && entry.synonyms.length > 0 &&
                    entry.synonyms.length <= 20 &&
                    entry.synonyms.every(value => nonempty(value) && value.length <= 80) &&
                    Array.isArray(entry.antonyms) && entry.antonyms.length <= 20 &&
                    entry.antonyms.every(value => typeof value === 'string' && value.length <= 80) &&
                    ['pronunciation','partOfSpeech','memoryHook','watchOut','fillSentence','typedSentence']
                        .every(key => entry[key] == null || (typeof entry[key] === 'string' && entry[key].length <= 350))));
            if (!validSources) return send(400,{error:'Invalid parent-supplied vocabulary details.'});
            if (!Array.isArray(existing) || existing.length>5000 ||
                existing.some(x => !nonempty(x) || x.length>40) ||
                !Number.isInteger(count) || count < 1 || count > 12 ||
                (requested !== undefined && (!Array.isArray(requested) || requested.length !== count ||
                    !unique(requested) || requested.some(w => typeof w !== 'string' ||
                        !/^[a-z][a-z-]{2,24}$/i.test(w) ||
                        existing.some(e => e.toLowerCase() === w.toLowerCase())))))
                return send(400,{error:'Provide 1–12 distinct new words, or a valid count (1–12).'});
            const parentChoseWords=Array.isArray(requested);
            const writeGroup = (selectedWords, suppliedDetails) => {
                const groupCount = selectedWords?.length ?? count;
                return providerJSON(env, {
                schema:packSchema,schemaName:'spy_word_pack',maxTokens:Math.min(10500,Math.max(2500,groupCount * 1300)),
                instructions:`You create ACCURATE, age-appropriate ISEE middle-grade vocabulary study materials for a 10–12 year old.
                ${parentChoseWords ? `The PARENT chose exactly ${groupCount} words. Use precisely these words in exactly the supplied order and spelling; NEVER swap, add, or omit a word.` : `Choose exactly ${groupCount} DISTINCT established English vocabulary words, not neologisms, not proper nouns, not already in the provided list. Aim for authentic ISEE/SSAT 5th–7th grade difficulty.`}
                ${suppliedDetails ? `The parent has already supplied authoritative study information: definitions, synonyms, antonyms, mnemonic notes and possibly example sentences. NEVER reword or replace those supplied fields. Create original questions only for missing exercise fields, using the precise parent-supplied meaning. If a parent supplied a complete items object, preserve it. Do not hallucinate a different sense of the word.` : `For every word provide a simple factual definition, synonyms, antonyms, an English phonetic pronunciation, one clear memory tip and a useful nuance warning.`}
                inputAsTyped must be the correct spelling of lemma. flags is [] unless a term needs a parent sensitivity note.
                Include 3 spy/adventure-flavored exercises per word: fillIn (one ___ in sentence, answer equals the appropriate word form, 3 genuinely wrong options with meanings), synonym (1–3 accurate acceptedAnswers also in synonyms, exactly 3 clearly incorrect decoys with meanings), typed (a NEW sentence with one ___ and exact missing inflected word; formHint null or a tense hint). Do not repeat answers in the sentence, never put additional blanks. Ensure all distractors are plausible but unambiguously wrong.
                Avoid violence, bullying, bias, body shaming, personal data, and sensitive religious generalizations. Spy theme can include secret codes, museums, puzzles and gadgets. Return structured JSON only.`,
                input:JSON.stringify({alreadyInVault:existing,count:groupCount,requestedWords:selectedWords,parentSuppliedEntries:suppliedDetails})
                });
            };
            // Parent-selected packs can be large (3 exercises per word).
            // Generate at most three independent 4-word batches concurrently to
            // keep each provider response comfortably within the iOS timeout.
            // AI-picked packs keep the single-request path to avoid duplicates.
            const groups = parentChoseWords && count > 4
                ? Array.from({length:Math.ceil(count / 4)},(_,i)=>i*4)
                : null;
            const output = groups
                ? {words:(await Promise.all(groups.map(start =>
                    writeGroup(requested.slice(start,start+4),sourceEntries?.slice(start,start+4))
                ))).flatMap(part => Array.isArray(part?.words) ? part.words : [])}
                : await writeGroup(requested,sourceEntries);
            // Parent-authored facts always override model-generated material.
            if (Array.isArray(sourceEntries) && Array.isArray(output.words) && output.words.length === count) {
                output.words = output.words.map((word,i) => {
                    const source=sourceEntries[i];
                    return {...word,lemma:source.lemma,inputAsTyped:source.lemma,
                        definition:source.definition,synonyms:source.synonyms,antonyms:source.antonyms,
                        pronunciation:source.pronunciation || word.pronunciation,
                        partOfSpeech:source.partOfSpeech || word.partOfSpeech,
                        memoryHook:source.memoryHook || word.memoryHook,
                        watchOut:source.watchOut || word.watchOut,
                        items:source.suppliedItems || {
                            ...word.items,synonym:{...word.items.synonym,acceptedAnswers:source.synonyms.slice(0,3)}
                        }};
                });
            }
            if (!validatePack(output.words,existing,count) ||
                (parentChoseWords && !output.words.every((word,index) =>
                    word.lemma.toLowerCase() === requested[index].toLowerCase())))
                return send(422,{error:'AI changed the selected words or generated invalid questions. No words were added; try again.'});
            return send(200,{pack:{id:`draft-${crypto.randomUUID()}`,
                title:parentChoseWords?'Your words · AI questions':'AI word candidates',
                source:parentChoseWords?'Parent-selected words; AI-generated exercises':'AI-generated; awaiting parent approval',
                status:'draft',trapWords:[],words:output.words}});
        }
        const questions=body?.questions;
        if (!Array.isArray(questions) || questions.length<1 || questions.length>48 ||
            !unique(questions.map(q => q?.id || '')) || questions.some(q =>
            !nonempty(q?.id) || q.id.length>80 || !['fillIn','typed'].includes(q.mode) ||
            !nonempty(q.lemma) || !nonempty(q.definition) || !nonempty(q.answer) ||
            !nonempty(q.originalSentence) || q.originalSentence.length>400))
            return send(400,{error:'Invalid question list (1–48 fillIn/typed questions required)'});
        const output=await providerJSON(env, {
            schema:clueSchema,schemaName:'spy_fresh_clues',maxTokens:4500,
            instructions:`You write NEW, age-appropriate spy/adventure ISEE vocabulary fill-in sentences.
            For EVERY input question return its exact id and a DIFFERENT novel sentence containing precisely one ___ where the EXACT specified answer belongs, with correct grammar and word form.
            Do not change the vocabulary target or answer. Do not include the answer anywhere else in its sentence.
            Make the meaning clear from context, avoid easy factual errors and ambiguous distractors, and keep each sentence below 220 characters. Spy adventure should be fun and suitable for a ten-year-old; avoid harm or violence. Output only the required JSON.`,
            input:JSON.stringify({questions:questions.map(({id,mode,lemma,definition,answer,originalSentence}) => ({id,mode,lemma,definition,answer,originalSentence}))})
        });
        const valid=validateFreshClues(output.clues,questions);
        if (valid.length===0) return send(422,{error:'AI generated no valid sentence alternatives'});
        return send(200,{clues:valid});
    }catch(error){
        const status=Number(error?.status)||500;
        console.error('Spy Words Worker:',status,error?.message);
        return send(status>=400&&status<=599?status:500,
            {error:status>=500?'AI generation failed. Please retry or use offline clues.':error.message});
    }
}
