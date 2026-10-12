// Thin client. x-user / x-role headers stand in for Microsoft Entra ID claims in the prototype;
// with Azure Static Web Apps built-in auth these come from /.auth/me (stretch).
export const api = (user, role) => {
  const h = { 'Content-Type': 'application/json', 'x-user': user, 'x-role': role };
  const j = async (r) => { const b = await r.json(); if (!r.ok) throw new Error(b.error || r.statusText); return b; };
  return {
    rules: () => fetch('/api/rules').then(j),
    list: () => fetch('/api/requests').then(j),
    get: (id) => fetch(`/api/requests/${id}`).then(j),
    create: (body) => fetch('/api/requests', { method: 'POST', headers: h, body: JSON.stringify(body) }).then(j),
    approve: (id, decision, note) => fetch(`/api/requests/${id}/approve`, { method: 'POST', headers: h, body: JSON.stringify({ decision, note }) }).then(j),
    deploy: (id) => fetch(`/api/requests/${id}/deploy`, { method: 'POST', headers: h }).then(j),
    explain: (id, question) => fetch(`/api/requests/${id}/explain`, { method: 'POST', headers: h, body: JSON.stringify({ question }) }).then(j),
    audit: (id) => fetch(`/api/audit/${id || ''}`).then(j),
    metrics: () => fetch('/api/metrics').then(j),
  };
};
