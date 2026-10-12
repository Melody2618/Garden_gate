// API client. The server is the source of truth: the browser sends request ids, never request objects, and stores nothing
// but a short-lived signed token per demo user (in memory). Roles are decided by the server from the signed-in user.
// In a pilot, sign-in moves to Microsoft Entra ID via Static Web Apps auth.
const DEMO_PASSWORD = 'launchgate-demo'; // demo accounts only; matches api DEMO_PASSWORD default
const tokens = {};

const post = async (op, body, token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`/api/gate/${op}?op=${op}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(b.error || r.statusText), { status: r.status });
  return b;
};

export const api = (user) => {
  const token = async (fresh) => {
    if (fresh || !tokens[user]) tokens[user] = (await post('login', { username: user, password: DEMO_PASSWORD })).token;
    return tokens[user];
  };
  // Retry once with a fresh token if the old one expired or the server restarted with a new secret.
  const call = async (op, body) => {
    try { return await post(op, body, await token()); }
    catch (e) { if (e.status !== 401) throw e; return post(op, body, await token(true)); }
  };
  return {
    me: () => call('me'),
    rules: () => call('rules'),
    list: () => call('list'),
    get: (id) => call('get', { id }),
    create: (form) => call('create', { form }),
    ingest: (id, code) => call('ingest', { id, code }),
    approve: (id, decision, note) => call('approve', { id, decision, note }),
    deploy: (id) => call('deploy', { id }),
    explain: (id, question) => call('explain', { id, question }),
    audit: (id) => call('audit', { id }),
    metrics: () => call('metrics'),
    exportAudit: () => call('export'),
  };
};
