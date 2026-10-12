// Local dev server on plain Node (no Core Tools needed): POST http://localhost:7071/api/gate/{op}
const http = require('http');
const { handle } = require('./src/lib/core');
http.createServer((q, s) => {
  let body = ''; q.on('data', (c) => (body += c));
  q.on('end', async () => {
    const op = q.url.replace(/^\/api\/gate\//, '').split('?')[0];
    try { const out = await handle(op, body ? JSON.parse(body) : {}, { 'x-user': q.headers['x-user'], 'x-role': q.headers['x-role'] }); s.writeHead(out.status, { 'content-type': 'application/json' }); s.end(JSON.stringify(out.body)); }
    catch (e) { s.writeHead(e.status || 500, { 'content-type': 'application/json' }); s.end(JSON.stringify({ error: e.message })); }
  });
}).listen(7071, () => console.log('LaunchGate API on http://localhost:7071'));
