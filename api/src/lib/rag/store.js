// Vector store. Remote Supabase (pgvector) when SUPABASE_URL + SUPABASE_SERVICE_KEY are set, otherwise in-memory so the demo works offline.
// Interface: upsert(rows: {scope, text, meta, embedding}[]), search(embedding, scope[], k), clear(scope)
// scope = 'policy' for the rule corpus, or the request id (e.g. 'REQ-AB12CD') for submitted code.
const { supabase, supabaseEnv } = require('../supabase');
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0); // vectors are normalized, so dot product = cosine similarity

function memoryStore() {
  let rows = [];
  return {
    kind: 'memory',
    async upsert(batch) { rows.push(...batch); },
    async search(embedding, scopes, k) {
      return rows.filter((r) => scopes.includes(r.scope)).map((r) => ({ ...r, score: dot(r.embedding, embedding) })).sort((a, b) => b.score - a.score).slice(0, k).map(({ embedding: _e, ...r }) => r);
    },
    async clear(scope) { rows = rows.filter((r) => r.scope !== scope); },
  };
}

function supabaseStore(url, key) {
  const call = supabase(url, key);
  return {
    kind: 'supabase',
    upsert: (batch) => call('rag_chunks', { method: 'POST', body: JSON.stringify(batch) }),
    search: (embedding, scopes, k) => call('rpc/match_chunks', { method: 'POST', body: JSON.stringify({ query_embedding: embedding, scopes, match_count: k }) }),
    clear: (scope) => call(`rag_chunks?scope=eq.${encodeURIComponent(scope)}`, { method: 'DELETE' }),
  };
}

let store;
function getStore() {
  if (!store) { const s = supabaseEnv(); store = s ? supabaseStore(s.url, s.key) : memoryStore(); }
  return store;
}
module.exports = { getStore, memoryStore, supabaseStore };
