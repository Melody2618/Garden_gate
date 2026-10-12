// Azure Functions v4 adapter: POST /api/gate/{op}
const { app } = require('@azure/functions');
const { handle } = require('../lib/core');
app.http('gate', { route: 'gate/{op}', methods: ['GET', 'POST'], authLevel: 'anonymous', handler: async (r) => {
  const body = r.method === 'POST' ? await r.json().catch(() => ({})) : {};
  const headers = { authorization: r.headers.get('authorization') };
  try { const out = await handle(r.params.op, body, headers); return { status: out.status, jsonBody: out.body }; }
  catch (e) { return { status: e.status || 500, jsonBody: { error: e.status ? e.message : 'internal error' } }; }
}});
