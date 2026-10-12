// Local embeddings: open model from Hugging Face run in-process with transformers.js (ONNX). No API key, no network after first model download.
// 384-dim, matches the vector(384) column in db/schema.sql.
const MODEL = process.env.RAG_EMBED_MODEL || 'Xenova/all-MiniLM-L6-v2';
const BATCH = 32; // texts per model call: batched for speed, capped so a 20k-char submission does not build one huge tensor

// One shared load: concurrent first calls wait on the same promise instead of each loading the model. A failed load is retried.
let loading;
const model = () => (loading ||= import('@huggingface/transformers') // ESM-only package, so dynamic import from CommonJS
  .then(({ pipeline }) => pipeline('feature-extraction', MODEL))
  .catch((e) => { loading = null; throw e; }));

async function embed(texts) {
  if (!texts.length) return [];
  const extractor = await model();
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) out.push(...(await extractor(texts.slice(i, i + BATCH), { pooling: 'mean', normalize: true })).tolist());
  return out;
}
module.exports = { embed, MODEL };
