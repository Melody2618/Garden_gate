// Local dev server on plain Node (no Core Tools needed): POST http://localhost:7071/api/gate/{op}
// Loads api/local.settings.json "Values" into the environment, like `func start` does, so secrets stay out of code.
const fs = require('fs');
const path = require('path');
try { Object.assign(process.env, { ...JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8')).Values, ...process.env }); } catch {}
const http = require('http');
const { respond } = require('./src/lib/core');
const MAX_BODY = 64 * 1024;
http.createServer((q, s) => {
  let body = ''; let tooBig = false;
  q.on('data', (c) => { body += c; if (body.length > MAX_BODY) { tooBig = true; q.destroy(); } });
  q.on('end', async () => {
    const send = (status, obj) => { s.writeHead(status, { 'content-type': 'application/json' }); s.end(JSON.stringify(obj)); };
    if (tooBig) return;
    const op = q.url.replace(/^\/api\/gate\//, '').split('?')[0];
    let parsed; try { parsed = body ? JSON.parse(body) : {}; } catch { return send(400, { error: 'invalid JSON' }); }
    const out = await respond(op, parsed, { authorization: q.headers.authorization }); send(out.status, out.body);
  });
}).listen(7071, '127.0.0.1', () => console.log('LaunchGate API on http://localhost:7071'));
