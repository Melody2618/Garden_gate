const { app } = require('@azure/functions');
const store = require('../lib/store');
const { evaluate, RULES } = require('../lib/engine');
const { explain } = require('../lib/explain');
const fs = require('fs');
const path = require('path');

const actorOf = (r) => r.headers.get('x-user') || 'demo.engineer';
const roleOf = (r) => r.headers.get('x-role') || 'requester';
const json = (body, status = 200) => ({ status, jsonBody: body });

app.http('rules', { route: 'rules', methods: ['GET'], authLevel: 'anonymous', handler: async () => json(RULES) });

app.http('createRequest', { route: 'requests', methods: ['POST'], authLevel: 'anonymous', handler: async (r) => {
  const payload = await r.json();
  const req = store.create(payload, actorOf(r));
  req.evaluation = evaluate(req);
  req.status = req.evaluation.verdict === 'blocked' ? 'blocked' : 'awaiting-approval';
  store.log(req.id, 'rule-engine', 'evaluated', { verdict: req.evaluation.verdict, failed: req.evaluation.failed, requiredApprovers: req.evaluation.requiredApprovers });
  return json(req, 201);
}});

app.http('listRequests', { route: 'requests', methods: ['GET'], authLevel: 'anonymous', handler: async () => json(store.list()) });
app.http('getRequest', { route: 'requests/{id}', methods: ['GET'], authLevel: 'anonymous', handler: async (r) => { const q = store.get(r.params.id); return q ? json(q) : json({ error: 'not found' }, 404); } });

app.http('approve', { route: 'requests/{id}/approve', methods: ['POST'], authLevel: 'anonymous', handler: async (r) => {
  const req = store.get(r.params.id); if (!req) return json({ error: 'not found' }, 404);
  const role = roleOf(r), actor = actorOf(r); const { decision = 'approve', note = '' } = await r.json().catch(() => ({}));
  if (!req.evaluation.requiredApprovers.includes(role)) return json({ error: `role ${role} is not a required approver` }, 403);
  if (actor === req.requester) return json({ error: 'separation of duties: a requester cannot approve their own request' }, 403);
  if (req.status !== 'awaiting-approval') return json({ error: `request is ${req.status}` }, 409);
  req.approvals[role] = { actor, decision, note, ts: new Date().toISOString() };
  store.log(req.id, actor, decision === 'approve' ? 'approved' : 'rejected', { role, note });
  if (decision !== 'approve') req.status = 'rejected';
  else if (req.evaluation.requiredApprovers.every((a) => req.approvals[a]?.decision === 'approve')) { req.status = 'approved'; store.log(req.id, 'workflow', 'all-approvals-complete', {}); }
  return json(req);
}});

app.http('deploy', { route: 'requests/{id}/deploy', methods: ['POST'], authLevel: 'anonymous', handler: async (r) => {
  const req = store.get(r.params.id); if (!req) return json({ error: 'not found' }, 404);
  if (req.status !== 'approved') return json({ error: 'gate: only an approved request can be deployed' }, 409);
  const template = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'infra', 'templates', 'dev-environment.bicep'), 'utf8');
  req.deployment = { mode: 'simulated', target: 'azure', region: req.region, resourceGroup: `rg-${req.projectName}-dev`, templateLines: template.split('\n').length, startedAt: new Date().toISOString() };
  req.status = 'deployed';
  store.log(req.id, actorOf(r), 'deploy-simulated', req.deployment);
  return json(req);
}});

app.http('explain', { route: 'requests/{id}/explain', methods: ['POST'], authLevel: 'anonymous', handler: async (r) => {
  const req = store.get(r.params.id); if (!req) return json({ error: 'not found' }, 404);
  const { question } = await r.json().catch(() => ({}));
  const out = await explain(req, req.evaluation, question);
  store.log(req.id, 'foundry-agent', 'explained', { source: out.source });
  return json(out);
}});

app.http('audit', { route: 'audit/{id?}', methods: ['GET'], authLevel: 'anonymous', handler: async (r) => json(store.auditFor(r.params.id)) });

app.http('metrics', { route: 'metrics', methods: ['GET'], authLevel: 'anonymous', handler: async () => {
  const all = store.list();
  const done = all.filter((q) => q.deployment);
  const avgMinutes = done.length ? done.reduce((s, q) => s + (new Date(q.deployment.startedAt) - new Date(q.createdAt)) / 60000, 0) / done.length : null;
  return json({ requests: all.length, blocked: all.filter((q) => q.status === 'blocked').length, deployed: done.length, baselineHandoffs: 12, handoffsPerRequest: 1, avgMinutesRequestToDeploy: avgMinutes });
}});
