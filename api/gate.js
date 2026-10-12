// Vercel serverless adapter: POST /api/gate?op=create  (same core as the Azure Functions adapter)
const { respond } = require('./src/lib/core');
module.exports = async (req, res) => {
  const op = (req.query && req.query.op) || (req.url.split('op=')[1] || '').split('&')[0];
  let body = req.body || {}; if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const out = await respond(op, body, { authorization: req.headers.authorization });
  res.status(out.status).json(out.body);
};
