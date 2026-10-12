// Vercel serverless adapter: POST /api/gate?op=create  (same core as the Azure Functions adapter)
const { handle } = require('./src/lib/core');
module.exports = async (req, res) => {
  const op = (req.query && req.query.op) || (req.url.split('op=')[1] || '').split('&')[0];
  let body = req.body || {}; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  try { const out = await handle(op, body, { 'x-user': req.headers['x-user'], 'x-role': req.headers['x-role'] }); res.status(out.status).json(out.body); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
};
