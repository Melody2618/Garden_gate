// Stateless core: every operation takes the request object and returns the updated one. Works on any host.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { evaluate, RULES } = require('./engine');
const { explain } = require('./explain');

const stamp = (req, actor, action, detail) => { req.audit = req.audit || []; req.audit.push({ ts: new Date().toISOString(), actor, action, detail }); return req; };

function create(form, actor) {
  const req = { id: 'REQ-' + crypto.randomBytes(3).toString('hex').toUpperCase(), createdAt: new Date().toISOString(), requester: actor, approvals: {}, audit: [], ...form };
  stamp(req, actor, 'submitted', { template: form.template });
  req.evaluation = evaluate(req);
  req.status = req.evaluation.verdict === 'blocked' ? 'blocked' : 'awaiting-approval';
  stamp(req, 'rule-engine', 'evaluated', { verdict: req.evaluation.verdict, failed: req.evaluation.failed, requiredApprovers: req.evaluation.requiredApprovers, riskScore: req.evaluation.model.riskScore, tier: req.evaluation.model.tier });
  return req;
}
function approve(req, role, actor, decision = 'approve', note = '') {
  if (!req.evaluation.requiredApprovers.includes(role)) throw Object.assign(new Error(`role ${role} is not a required approver`), { status: 403 });
  if (actor === req.requester) throw Object.assign(new Error('separation of duties: a requester cannot approve their own request'), { status: 403 });
  if (req.status !== 'awaiting-approval') throw Object.assign(new Error(`request is ${req.status}`), { status: 409 });
  req.approvals[role] = { actor, decision, note, ts: new Date().toISOString() };
  stamp(req, actor, decision === 'approve' ? 'approved' : 'rejected', { role, note });
  if (decision !== 'approve') req.status = 'rejected';
  else if (req.evaluation.requiredApprovers.every((a) => req.approvals[a]?.decision === 'approve')) { req.status = 'approved'; stamp(req, 'workflow', 'all-approvals-complete', {}); }
  return req;
}
function deploy(req, actor) {
  if (req.status !== 'approved') throw Object.assign(new Error('gate: only an approved request can be deployed'), { status: 409 });
  let lines = 40; try { lines = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'infra', 'templates', 'dev-environment.bicep'), 'utf8').split('\n').length; } catch {}
  req.deployment = { mode: 'simulated', target: 'azure', region: req.region, resourceGroup: `rg-${req.projectName}-dev`, templateLines: lines, startedAt: new Date().toISOString() };
  req.status = 'deployed';
  stamp(req, actor, 'deploy-simulated', req.deployment);
  return req;
}
async function ask(req, question) { const out = await explain(req, req.evaluation, question); stamp(req, 'foundry-agent', 'explained', { source: out.source }); return { req, ...out }; }

// One dispatcher shared by every host adapter. body: { op, form|req, role, actor, decision, note, question }
async function handle(op, body, headers) {
  const actor = headers['x-user'] || 'demo.engineer', role = headers['x-role'] || 'requester';
  switch (op) {
    case 'rules': return { status: 200, body: RULES };
    case 'create': return { status: 201, body: create(body.form, actor) };
    case 'approve': return { status: 200, body: approve(body.req, role, actor, body.decision, body.note) };
    case 'deploy': return { status: 200, body: deploy(body.req, actor) };
    case 'explain': return { status: 200, body: await ask(body.req, body.question) };
    default: return { status: 404, body: { error: 'unknown op ' + op } };
  }
}
module.exports = { handle, create, approve, deploy, ask };
