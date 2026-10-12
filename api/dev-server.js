// Local dev server: hosts the Azure Functions v4 handlers on plain Node when Core Tools is unavailable.
const http = require('http'); const Module = require('module');
const routes = [];
const fake = { app: { http: (name, { route, methods, handler }) => routes.push({ route, methods, handler }) } };
const orig = Module._load; Module._load = function (req, ...a) { return req === '@azure/functions' ? fake : orig.call(this, req, ...a); };
require('./src/functions/requests.js');
const match = (route, p) => { const rs = route.split('/'), ps = p.split('/'); if (rs.length !== ps.length && !(route.endsWith('?') && ps.length === rs.length - 1)) return null; const params = {}; for (let i = 0; i < rs.length; i++) { if (rs[i].startsWith('{')) params[rs[i].replace(/[{}?]/g, '')] = ps[i]; else if (rs[i] !== ps[i]) return null; } return params; };
http.createServer((q, s) => { const p = q.url.replace(/^\/api\//, '').split('?')[0]; let body = ''; q.on('data', (c) => body += c);
  q.on('end', async () => { for (const r of routes) { const params = match(r.route, p); if (params && r.methods.includes(q.method)) {
      const res = await r.handler({ params, headers: { get: (k) => q.headers[k.toLowerCase()] }, json: async () => JSON.parse(body || '{}') });
      s.writeHead(res.status || 200, { 'content-type': 'application/json' }); return s.end(JSON.stringify(res.jsonBody)); } }
    s.writeHead(404); s.end('{"error":"no route"}'); }); }).listen(7071, () => console.log('LaunchGate API on http://localhost:7071'));
