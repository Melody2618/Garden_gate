// RAG pipeline: ingest policies + submitted code, retrieve context, answer with a local open model.
// The rule engine still decides pass/fail; RAG only retrieves context and explains. Embedder, store and generator are injectable for tests.
// Callers must pass code that has already been scrubbed of secrets (see ../scrub.js).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chunkCode, ruleChunk } = require('./chunk');
const { getStore } = require('./store');
const { embed: defaultEmbed } = require('./embed');
const { generate, available } = require('./generate');

const SYSTEM = fs.readFileSync(path.join(__dirname, 'system-prompt.md'), 'utf8'); // lives inside api/ so it ships with the deployed API

// Re-ingesting a scope replaces its chunks, including with nothing: empty code must still remove the old code's chunks.
async function ingest(scope, chunks, { embed = defaultEmbed, store = getStore() } = {}) {
  const vecs = chunks.length ? await embed(chunks.map((c) => c.text)) : []; // embed first, so the scope is empty only briefly
  await store.clear(scope);
  if (chunks.length) await store.upsert(chunks.map((c, i) => ({ scope, text: c.text, meta: c.meta, embedding: vecs[i] })));
  return chunks.length;
}
const ingestPolicies = (rules, opts) => ingest('policy', rules.map(ruleChunk), opts);
const ingestChange = (reqId, code, opts) => ingest(reqId, chunkCode(code), opts);

// What this process has indexed, keyed by store so tests with separate stores do not collide. Kept server-side:
// after a restart the map is empty and everything is re-indexed once, which is correct for the in-memory store
// and a harmless refresh for Supabase.
const indexed = new WeakMap();
const seen = (store) => { if (!indexed.has(store)) indexed.set(store, new Map()); return indexed.get(store); };

async function ensurePolicies(opts = {}) {
  const store = opts.store || getStore();
  const m = seen(store);
  if (!m.has('policy')) {
    const p = ingestPolicies(require('../engine').RULES, { ...opts, store });
    m.set('policy', p);
    p.catch(() => m.delete('policy')); // a failed load (e.g. model download) is retried next call, not cached forever
  }
  await m.get('policy');
}
// Index a request's current code (empty code clears it). Per request, indexing runs one at a time: a call for the same
// code joins the one in flight, and a call for new code waits for it, so two calls can never both clear and both insert.
async function ensureIndexed(reqId, code, opts = {}) {
  code = code || '';
  const store = opts.store || getStore();
  const m = seen(store);
  const hash = crypto.createHash('sha1').update(code).digest('hex');
  const cur = m.get(reqId);
  if (cur?.hash === hash) { await cur.done; return false; }
  const done = (cur ? cur.done.catch(() => {}) : Promise.resolve()).then(() => ingestChange(reqId, code, { ...opts, store }));
  m.set(reqId, { hash, done });
  done.catch(() => { if (m.get(reqId)?.done === done) m.delete(reqId); }); // a failed index is retried next call
  await done;
  return true;
}

async function retrieve(reqId, question, { k = 4, embed = defaultEmbed, store = getStore() } = {}) {
  const [q] = await embed([question]);
  // Search each scope separately so neither the policy text nor a long code change can crowd out the other.
  const [policy, code] = await Promise.all([store.search(q, ['policy'], k), store.search(q, [reqId], k)]);
  return [...policy, ...code];
}

// Guardrail on the output: flag any rule ID the model cites that does not exist. Shown to the user, never silently fixed.
function checkCitations(text, knownIds) {
  const cited = [...new Set(String(text).match(/GG-\d{3}/g) || [])];
  return { cited, unknown: cited.filter((id) => !knownIds.includes(id)) };
}

// Returns { answer, sources, citations } or null when no local model is available (caller falls back).
async function answer(req, evaluation, question, opts = {}) {
  const gen = opts.generate || generate;
  if (!opts.generate && !(await available())) return null; // skip embedding work when there is no model to answer
  await ensurePolicies(opts); await ensureIndexed(req.id, req.code, opts);
  const context = await retrieve(req.id, question, opts);
  const ctx = context.map((c, i) => c.scope === 'policy'
    ? `[${i + 1}] policy ${c.meta.ruleId || ''}: ${c.text}`
    : `[${i + 1}] submitted code lines ${c.meta.startLine}-${c.meta.endLine}:\n<untrusted_code>\n${c.text.replace(/<\/?untrusted_code>/g, '')}\n</untrusted_code>`).join('\n\n');
  const user = `Question: ${question}\n\nStatus: ${req.status}\nFailed rules: ${evaluation.failed.join(', ') || 'none'}\nRequired approvers: ${evaluation.requiredApprovers.join(', ')}\n\nRetrieved context:\n${ctx}`;
  const text = await gen(SYSTEM, user);
  if (!text) return null;
  return { answer: text, sources: context.map((c) => ({ scope: c.scope, meta: c.meta, score: c.score })), citations: checkCitations(text, evaluation.results.map((r) => r.id)) };
}
module.exports = { ingest, ingestPolicies, ingestChange, ensureIndexed, retrieve, answer, checkCitations };
