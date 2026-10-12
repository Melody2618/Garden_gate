// Azure Functions v4 adapter: POST /api/gate/{op}
const { app } = require('@azure/functions');
const { respond } = require('../lib/core');
app.http('gate', { route: 'gate/{op}', methods: ['GET', 'POST'], authLevel: 'anonymous', handler: async (r, context) => {
  const body = r.method === 'POST' ? await r.json().catch(() => ({})) : {};
  const out = await respond(r.params.op, body, { authorization: r.headers.get('authorization') }, (...a) => context.error(...a));
  return { status: out.status, jsonBody: out.body };
}});
