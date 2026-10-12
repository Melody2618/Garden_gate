// Minimal PostgREST client shared by db.js and rag/store.js. Server-side only: it uses the service_role key, which bypasses RLS.
function supabase(url, key) {
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  return async (path, init = {}) => {
    const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...h, ...init.headers } });
    if (!r.ok) throw new Error(`supabase ${r.status}: ${await r.text()}`);
    const t = await r.text(); return t ? JSON.parse(t) : null;
  };
}

// { url, key } from SUPABASE_URL + SUPABASE_SERVICE_KEY, or null when not configured (callers fall back to in-memory).
function supabaseEnv() {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_KEY: key } = process.env;
  return url && key ? { url: url.replace(/\/+$/, '').replace(/\/rest\/v1$/, ''), key } : null; // tolerate the REST URL pasted with /rest/v1
}
module.exports = { supabase, supabaseEnv };
