// Core API, shared by every host adapter. Stateful: requests and audit live server-side (db.js); the client sends ids, never request objects.
// Every call except `login` is authenticated (auth.js) and authorized against PERMS below. Every state change and every
// denied action is written to the append-only audit log.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { evaluate, RULES } = require('./engine');
const { explain } = require('./explain');
const { getDb } = require('./db');
const { fail } = require('./errors');
const auth = require('./auth');
const { validateForm, validateCode, validateId, validateText } = require('./validate');
const { scrub } = require('./scrub');

const ALL = ['requester', 'security', 'platform', 'compliance', 'viewer'];
const APPROVERS = ['security', 'platform', 'compliance'];
// Least privilege: which roles may call each op. Row-level scoping (requesters only see their own) is applied on top in load().
const PERMS = {
  me: ALL, rules: ALL, list: ALL, get: ALL, audit: ALL, explain: ALL, metrics: ALL,
  create: ['requester'], ingest: ['requester'],
  approve: APPROVERS, deploy: ['platform'],
  export: ['security', 'platform', 'compliance', 'viewer'],
};

const stamp = (requestId, actor, action, detail = {}) => getDb().appendAudit({ request_id: requestId, actor, action, detail });

// Load a request the caller is allowed to see. A requester asking for someone else's request gets 404, not 403,
// so ids of other people's requests cannot be confirmed by probing. Writes go through getDb().updateRequest, which
// refuses (409) if anyone else saved the request since this load, so the checks below never act on a stale copy.
async function load(id, who) {
  const req = await getDb().getRequest(validateId(id));
  if (!req || (who.role === 'requester' && req.requester !== who.user)) throw fail(404, 'request not found');
  return req;
}

async function create(form, who) {
  const f = validateForm(form);
  let codeInfo;
  if (f.code !== undefined) { const s = scrub(f.code); f.code = s.text; codeInfo = { chars: s.text.length, redactions: s.redactions }; }
  const req = { ...f, id: 'REQ-' + crypto.randomBytes(4).toString('hex').toUpperCase(), createdAt: new Date().toISOString(), requester: who.user, approvals: {} };
  req.evaluation = evaluate(req);
  req.status = req.evaluation.verdict === 'blocked' ? 'blocked' : 'awaiting-approval';
  await getDb().insertRequest(req);
  await stamp(req.id, who.user, 'submitted', { template: req.template, ...(codeInfo && { code: codeInfo }) });
  await stamp(req.id, 'rule-engine', 'evaluated', { verdict: req.evaluation.verdict, failed: req.evaluation.failed, requiredApprovers: req.evaluation.requiredApprovers, riskScore: req.evaluation.model.riskScore, tier: req.evaluation.model.tier });
  return req;
}

// Attach or replace code on a request. Only before any approval, so approvers never sign off on code that later changes.
async function ingest(id, code, who) {
  const req = await load(id, who);
  if (!['blocked', 'awaiting-approval'].includes(req.status) || Object.keys(req.approvals).length) throw fail(409, 'code can only change before any approval');
  const s = scrub(validateCode(code));
  req.code = s.text;
  await getDb().updateRequest(req);
  await stamp(req.id, who.user, 'code-submitted', { chars: s.text.length, redactions: s.redactions });
  return req;
}

async function approve(id, decision, note, who) {
  const req = await load(id, who);
  if (!['approve', 'reject'].includes(decision)) throw fail(400, 'decision must be approve or reject');
  note = validateText(note, 'note');
  if (!req.evaluation.requiredApprovers.includes(who.role)) throw fail(403, `role ${who.role} is not a required approver`);
  if (who.user === req.requester) throw fail(403, 'separation of duties: a requester cannot approve their own request');
  if (req.status !== 'awaiting-approval') throw fail(409, `request is ${req.status}`);
  if (req.approvals[who.role]) throw fail(409, `${who.role} has already decided`);
  req.approvals[who.role] = { actor: who.user, decision, note, ts: new Date().toISOString() };
  if (decision !== 'approve') req.status = 'rejected';
  else if (req.evaluation.requiredApprovers.every((a) => req.approvals[a]?.decision === 'approve')) req.status = 'approved';
  await getDb().updateRequest(req);
  await stamp(req.id, who.user, decision === 'approve' ? 'approved' : 'rejected', { role: who.role, note });
  if (req.status === 'approved') await stamp(req.id, 'workflow', 'all-approvals-complete');
  return req;
}

async function deploy(id, who) {
  const req = await load(id, who);
  if (req.status !== 'approved') throw fail(409, 'gate: only an approved request can be deployed');
  let lines = 40; try { lines = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'infra', 'templates', 'dev-environment.bicep'), 'utf8').split('\n').length; } catch {}
  req.deployment = { mode: 'simulated', target: 'azure', region: req.region, resourceGroup: `rg-${req.projectName}-dev`, templateLines: lines, startedAt: new Date().toISOString() };
  req.status = 'deployed';
  await getDb().updateRequest(req);
  await stamp(req.id, who.user, 'deploy-simulated', req.deployment);
  return req;
}

async function ask(id, question, who) {
  const req = await load(id, who);
  const out = await explain(req, req.evaluation, validateText(question, 'question'));
  // The question itself is not logged (it may contain anything); only which path answered and any citation problems.
  await stamp(req.id, who.user, 'explained', { source: out.source, aiGenerated: out.aiGenerated, unknownCitations: out.citations?.unknown || [] });
  return out;
}

async function metrics(who) {
  const all = await getDb().listRequests(who.role === 'requester' ? { requester: who.user } : {});
  const done = all.filter((q) => q.deployment);
  const avg = done.length ? done.reduce((s, q) => s + (new Date(q.deployment.startedAt) - new Date(q.createdAt)) / 60000, 0) / done.length : null;
  return { requests: all.length, blocked: all.filter((q) => q.status === 'blocked').length, deployed: done.length, baselineHandoffs: 12, handoffsPerRequest: 1, avgMinutesRequestToDeploy: avg };
}

async function exportAudit(who) {
  const entries = await getDb().listAudit();
  await stamp(null, who.user, 'audit-exported', { entries: entries.length });
  return { generatedAt: new Date().toISOString(), generatedBy: who.user, entries };
}

async function dispatch(op, body, who) {
  switch (op) {
    case 'me': return who;
    case 'rules': return RULES;
    case 'list': return getDb().listRequests(who.role === 'requester' ? { requester: who.user } : {}); // summaries: never carry submitted code
    case 'get': return load(body.id, who);
    case 'audit': await load(body.id, who); return getDb().listAudit({ requestId: body.id });
    case 'create': return create(body.form, who);
    case 'ingest': return ingest(body.id, body.code, who);
    case 'approve': return approve(body.id, body.decision, body.note, who);
    case 'deploy': return deploy(body.id, who);
    case 'explain': return ask(body.id, body.question, who);
    case 'metrics': return metrics(who);
    case 'export': return exportAudit(who);
  }
}

// One entry point for every host adapter. headers: { authorization }. Returns { status, body }; throws errors with .status.
async function handle(op, body = {}, headers = {}) {
  body = body && typeof body === 'object' ? body : {};
  if (op === 'login') {
    try { return { status: 200, body: auth.login(body.username, body.password) }; }
    catch (e) {
      if ([401, 429].includes(e.status)) await stamp(null, String(body.username || 'unknown').slice(0, 64), e.status === 429 ? 'login-locked' : 'login-failed').catch(() => {});
      throw e;
    }
  }
  if (!Object.hasOwn(PERMS, op)) return { status: 404, body: { error: 'unknown op ' + String(op).slice(0, 40) } }; // not `in`: that also matches toString, __proto__...
  let who;
  try {
    who = auth.verify(headers.authorization);
    if (!PERMS[op].includes(who.role)) throw fail(403, `role ${who.role} may not ${op}`);
    return { status: op === 'create' ? 201 : 200, body: await dispatch(op, body, who) };
  } catch (e) {
    // Monitor: record denied and refused actions (401/403/404/409) with who, what and why. Never the token, password or code.
    if ([401, 403, 404, 409].includes(e.status)) await stamp(typeof body.id === 'string' ? body.id.slice(0, 20) : null, who?.user || 'anonymous', 'denied', { op, status: e.status, reason: e.message }).catch(() => {});
    throw e;
  }
}

// What every host adapter calls, so error mapping and logging live in one place. Never throws. Expected errors keep their
// status and message; anything else is logged server-side (log: console.error, or the host's logger) and the caller gets a
// bare "internal error" with no stack trace or internals.
async function respond(op, body, headers, log = console.error) {
  try { return await handle(op, body, headers); }
  catch (e) {
    if (!e.status) log(`gate ${String(op).slice(0, 40)} failed:`, e);
    return { status: e.status || 500, body: { error: e.status ? e.message : 'internal error' } };
  }
}
module.exports = { handle, respond, PERMS };
