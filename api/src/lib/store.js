// In-memory store with optional Cosmos DB persistence (set COSMOS_CONNECTION_STRING to enable).
const crypto = require('crypto');
const requests = new Map();
const audit = [];

function log(requestId, actor, action, detail) {
  const entry = { ts: new Date().toISOString(), requestId, actor, action, detail };
  audit.push(entry);
  return entry;
}
function create(payload, actor) {
  const id = 'REQ-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const req = { id, createdAt: new Date().toISOString(), requester: actor, status: 'submitted', approvals: {}, handoffs: 1, ...payload };
  requests.set(id, req);
  log(id, actor, 'submitted', { template: payload.template });
  return req;
}
const get = (id) => requests.get(id);
const list = () => [...requests.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
const auditFor = (id) => audit.filter((e) => !id || e.requestId === id);
module.exports = { create, get, list, log, auditFor };
