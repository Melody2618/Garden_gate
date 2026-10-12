// Local open-model generation through Ollama's HTTP API (e.g. `ollama pull llama3.2`). The model gets text in and text out:
// no tools, no network, no write access, so it cannot change state whatever it says.
const URL_ = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.RAG_LLM_MODEL || 'llama3.2';

// Cheap reachability check, cached for 30s, so callers can skip retrieval entirely when no model is running.
let cache = { at: 0, ok: false };
async function available() {
  if (Date.now() - cache.at < 30000) return cache.ok;
  let ok = false;
  try { const r = await fetch(`${URL_}/api/tags`, { signal: AbortSignal.timeout(1500) }); ok = r.ok && (await r.json()).models?.some((m) => m.name.startsWith(MODEL)); } catch {}
  cache = { at: Date.now(), ok };
  return ok;
}

async function generate(system, user) {
  try {
    const r = await fetch(`${URL_}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ model: MODEL, stream: false, options: { temperature: 0 }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!r.ok) return null;
    return (await r.json()).message?.content || null;
  } catch { return null; }
}
module.exports = { generate, available, MODEL };
