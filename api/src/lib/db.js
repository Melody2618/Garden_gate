// Server-side store for requests and the append-only audit log. The server's copy is the only source of truth:
// the browser sends an id, never a request object, so status/approvals/evaluation cannot be forged.
// Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_KEY are set; otherwise in-memory (offline demo, tests).
// Interface: getRequest(id), insertRequest(req), updateRequest(req), listRequests({ requester }), appendAudit(entry), listAudit({ requestId })
// Concurrency: every request carries a version. updateRequest writes only if the stored version is still the one the caller
// loaded, then bumps req.version; otherwise it throws 409, so two concurrent approvals or deploys can never both win.
// listRequests returns summaries: no submitted code, plus hasCode.
const { fail } = require('./errors');
const { supabase, supabaseEnv } = require('./supabase');

const clone = (o) => JSON.parse(JSON.stringify(o)); // callers get copies, so nothing outside db.js can mutate stored state
const conflict = () => fail(409, 'request was changed by someone else; reload and try again');
const summarize = ({ code, ...r }) => ({ ...r, hasCode: Boolean(code) });

function memoryDb() {
  const requests = new Map();
  const audit = [];
  return {
    kind: 'memory',
    async getRequest(id) { return requests.has(id) ? clone(requests.get(id)) : null; },
    async insertRequest(req) { if (requests.has(req.id)) throw new Error('duplicate id'); req.version = 1; requests.set(req.id, clone(req)); },
    async updateRequest(req) {
      const cur = requests.get(req.id);
      if (!cur) throw new Error('unknown id');
      if (cur.version !== req.version) throw conflict();
      req.version += 1; requests.set(req.id, clone(req));
    },
    async listRequests({ requester } = {}) { return [...requests.values()].filter((r) => !requester || r.requester === requester).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r) => summarize(clone(r))); },
    // Append-only: there is no update or delete method.
    async appendAudit(e) { audit.push(Object.freeze({ seq: audit.length + 1, ts: new Date().toISOString(), ...clone(e) })); },
    async listAudit({ requestId } = {}) { return audit.filter((e) => requestId === undefined || e.request_id === requestId).map(clone); },
  };
}

function supabaseDb(url, key) {
  const call = supabase(url, key);
  const q = encodeURIComponent;
  // Code lives in its own column so lists never transfer it; version is a column so the PATCH below can filter on it.
  const row = ({ code, version, ...doc }) => ({ id: doc.id, requester: doc.requester, status: doc.status, code: code ?? null, version, doc, updated_at: new Date().toISOString() });
  const fromRow = (r) => ({ ...r.doc, ...(r.code != null && { code: r.code }), version: r.version });
  return {
    kind: 'supabase',
    async getRequest(id) { const rows = await call(`requests?id=eq.${q(id)}&select=doc,code,version`); return rows[0] ? fromRow(rows[0]) : null; },
    async insertRequest(req) { await call('requests', { method: 'POST', body: JSON.stringify(row({ ...req, version: 1 })) }); req.version = 1; },
    async updateRequest(req) {
      // Conditional write: matches no row if someone else saved since we loaded, and PostgREST then returns [].
      const rows = await call(`requests?id=eq.${q(req.id)}&version=eq.${Number(req.version)}&select=id`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row({ ...req, version: req.version + 1 })) });
      if (!rows?.length) throw conflict();
      req.version += 1;
    },
    async listRequests({ requester } = {}) { return (await call(`requests?select=doc,version,has_code&order=created_at.desc${requester ? `&requester=eq.${q(requester)}` : ''}`)).map((r) => ({ ...r.doc, version: r.version, hasCode: r.has_code })); },
    async appendAudit(e) { await call('audit', { method: 'POST', body: JSON.stringify(e) }); },
    async listAudit({ requestId } = {}) { return call(`audit?order=seq.asc${requestId !== undefined ? `&request_id=eq.${q(requestId)}` : ''}`); },
  };
}

let db;
function getDb() {
  if (!db) { const s = supabaseEnv(); db = s ? supabaseDb(s.url, s.key) : memoryDb(); }
  return db;
}
module.exports = { getDb, memoryDb, supabaseDb };
