// Input validation: only whitelisted fields with the right types reach the request. Unknown keys are rejected,
// so a caller cannot inject status, approvals, evaluation, requester or audit through the form.
// Validation checks SHAPE only. Whether a value is compliant (e.g. region westeurope) is the rule engine's job, so those values are allowed here.
const { fail } = require('./errors');
const MAX_CODE = 20000; // characters of submitted code per request

const FIELDS = {
  template: (v) => v === 'azure-dev-environment',
  projectName: (v) => typeof v === 'string' && /^[a-z0-9][a-z0-9-]{2,39}$/.test(v),
  dataClass: (v) => ['internal', 'confidential', 'restricted'].includes(v),
  region: (v) => typeof v === 'string' && /^[a-z0-9]{3,20}$/.test(v),
  encryptionAtRest: (v) => typeof v === 'boolean',
  tlsOnly: (v) => typeof v === 'boolean',
  publicEndpoint: (v) => typeof v === 'boolean',
  loggingEnabled: (v) => typeof v === 'boolean',
  owner: (v) => typeof v === 'string' && v.length <= 80,
  costCenter: (v) => typeof v === 'string' && v.length <= 40,
  authMethod: (v) => ['managed-identity', 'connection-string'].includes(v),
};
// Optional: absent is fine, present must have the right shape. Program fields drive the partner and Agent Pay rules.
const optional = (ok) => (v) => v === undefined || ok(v);
const OPTIONAL = {
  program: optional((v) => ['card-program', 'agent-pay', 'internal-service'].includes(v)),
  partnerName: optional((v) => typeof v === 'string' && v.length <= 80),
  contractRef: optional((v) => typeof v === 'string' && v.length <= 80),
  intentAuditTrail: optional((v) => typeof v === 'boolean'),
  code: optional((v) => typeof v === 'string' && v.length <= MAX_CODE),
};
const HINT = { projectName: '3-40 chars, lowercase letters, digits and dashes', program: 'card-program, agent-pay or internal-service', code: `string up to ${MAX_CODE} characters` };

const bad = (message) => fail(400, message);

function validateForm(form) {
  if (!form || typeof form !== 'object' || Array.isArray(form)) throw bad('form must be an object');
  const unknown = Object.keys(form).filter((k) => !(k in FIELDS) && !(k in OPTIONAL));
  if (unknown.length) throw bad(`unknown field(s): ${unknown.join(', ')}`);
  for (const [k, ok] of Object.entries({ ...FIELDS, ...OPTIONAL })) {
    if (!ok(form[k])) throw bad(`invalid ${k}${HINT[k] ? ` (${HINT[k]})` : ''}`);
  }
  const out = {};
  for (const k of Object.keys(FIELDS)) out[k] = typeof form[k] === 'string' ? form[k].trim() : form[k];
  for (const k of Object.keys(OPTIONAL)) if (form[k] !== undefined) out[k] = typeof form[k] === 'string' && k !== 'code' ? form[k].trim() : form[k];
  return out;
}

function validateCode(code) { if (!OPTIONAL.code(code) || code === undefined) throw bad(`invalid code (${HINT.code})`); return code; }
function validateId(id) { if (typeof id !== 'string' || !/^REQ-[0-9A-F]{8}$/.test(id)) throw bad('invalid request id'); return id; }
function validateText(v, name, max = 500) { if (v !== undefined && (typeof v !== 'string' || v.length > max)) throw bad(`invalid ${name} (max ${max} chars)`); return v || ''; }

module.exports = { validateForm, validateCode, validateId, validateText, MAX_CODE };
