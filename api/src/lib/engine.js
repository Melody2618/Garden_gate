// Deterministic rule engine. Same input always gives the same result. No AI here.
const fs = require('fs');
const path = require('path');
const { score } = require('./model');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'rules', 'rules.json'), 'utf8'));

function applies(rule, req) {
  if (!rule.when) return true;
  return rule.when.in.includes(req[rule.when.field]);
}

function evaluate(req) {
  const results = RULES.map((rule) => {
    if (!applies(rule, req)) return { id: rule.id, name: rule.name, status: 'skipped', controls: rule.controls };
    let pass = true;
    if ('expect' in rule) pass = req[rule.field] === rule.expect;
    if (rule.expectOneOf) pass = rule.expectOneOf.includes(req[rule.field]);
    if (rule.expectNonEmpty) pass = rule.fields.every((f) => typeof req[f] === 'string' && req[f].trim().length > 0);
    if (rule.requireApprover) return { id: rule.id, name: rule.name, status: 'approval-required', approver: rule.requireApprover, controls: rule.controls, fix: rule.fix };
    return { id: rule.id, name: rule.name, status: pass ? 'pass' : 'fail', severity: rule.severity, controls: rule.controls, fix: pass ? undefined : rule.fix };
  });
  const failed = results.filter((r) => r.status === 'fail');
  const model = score(req);
  const approvers = new Set(model.approvers);
  results.filter((r) => r.status === 'approval-required').forEach((r) => approvers.add(r.approver));
  return { verdict: failed.length ? 'blocked' : 'compliant', results, failed: failed.map((f) => f.id), requiredApprovers: [...approvers], model };
}

module.exports = { evaluate, RULES };
