// Split submitted IaC/code into overlapping line windows, and flatten rules into one retrievable chunk each.
// 12 lines (~800 chars of Bicep, ~200 tokens) stays under all-MiniLM-L6-v2's 256-token training length; 25 lines did not.
function chunkCode(code, size = 12, overlap = 3) {
  const lines = String(code || '').split('\n');
  const chunks = [];
  for (let i = 0; i < lines.length; i += size - overlap) {
    const text = lines.slice(i, i + size).join('\n').trim();
    if (text) chunks.push({ text, meta: { startLine: i + 1, endLine: Math.min(i + size, lines.length) } });
    if (i + size >= lines.length) break;
  }
  return chunks;
}

function ruleChunk(rule) {
  const text = `${rule.id} ${rule.name}. Severity: ${rule.severity}. Controls: ${rule.controls.join('; ')}. Fix: ${rule.fix}`;
  return { text, meta: { ruleId: rule.id } };
}
module.exports = { chunkCode, ruleChunk };
