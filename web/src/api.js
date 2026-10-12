// Stateless API client: the browser keeps the list of requests (localStorage) and sends the request object with each operation.
// x-user / x-role headers stand in for Microsoft Entra ID claims in the prototype.
const KEY = 'launchgate.requests';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} };
const upsert = (req) => { const list = load().filter((q) => q.id !== req.id); list.unshift(req); save(list); return req; };
export const api = (user, role) => {
  const h = { 'Content-Type': 'application/json', 'x-user': user, 'x-role': role };
  const call = async (op, body) => { const r = await fetch(`/api/gate/${op}?op=${op}`, { method: 'POST', headers: h, body: JSON.stringify(body || {}) }); const b = await r.json(); if (!r.ok) throw new Error(b.error || r.statusText); return b; };
  const get = async (id) => load().find((q) => q.id === id);
  return {
    rules: () => call('rules'),
    list: async () => load(),
    get,
    create: async (form) => upsert(await call('create', { form })),
    approve: async (id, decision, note) => upsert(await call('approve', { req: await get(id), decision, note })),
    deploy: async (id) => upsert(await call('deploy', { req: await get(id) })),
    explain: async (id, question) => { const out = await call('explain', { req: await get(id), question }); upsert(out.req); return out; },
    audit: async (id) => (await get(id))?.audit || [],
    metrics: async () => { const all = load(); const done = all.filter((q) => q.deployment); const avg = done.length ? done.reduce((s, q) => s + (new Date(q.deployment.startedAt) - new Date(q.createdAt)) / 60000, 0) / done.length : null; return { requests: all.length, blocked: all.filter((q) => q.status === 'blocked').length, deployed: done.length, baselineHandoffs: 12, handoffsPerRequest: 1, avgMinutesRequestToDeploy: avg }; },
    reset: () => save([]),
  };
};
