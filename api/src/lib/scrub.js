// Secret scrubbing for submitted code. Runs BEFORE code is stored, embedded, or put in a prompt, so a key pasted by
// mistake never reaches the database, the vector store, the model or the audit log. Pattern-based: catches the common
// shapes, not every possible secret. Returns the cleaned text and how many values were redacted (count only, never the value).
const R = '[REDACTED]';
const KEY = '[\\w.-]*?(?:secret|password|passwd|api[_-]?key|access[_-]?key|token)'; // name ending in a secret word: db_password, apiKey, AZURE_CLIENT_SECRET
const FRESH = '(?!\\[REDACTED\\])'; // skip values an earlier pattern already redacted, so nothing is counted twice
// [pattern, replacement]. Where the pattern captured a key name it is kept for readability; only the value is redacted.
const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, R],                    // PEM private keys
  [/\b(AccountKey|SharedAccessKey|Password|Pwd)=[^;"'\s]+/gi, `$1=${R}`],                                 // Azure connection-string parts
  [/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, R],                                                                    // AWS access key ids
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, R],                                                                 // GitHub tokens
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, R],                                                                      // OpenAI/Anthropic-style API keys
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, R],                             // JWTs
  [new RegExp(`\\b(${KEY}['"]?\\s*[:=]\\s*)(['"])${FRESH}[^'"\\n]{6,}\\2`, 'gi'), `$1$2${R}$2`],         // key = 'value', "key": "value"
  [new RegExp(`^([ \\t]*(?:export[ \\t]+)?${KEY}=)${FRESH}[^\\s'"]{6,}[ \\t]*$`, 'gim'), `$1${R}`],      // .env line: KEY=value
];

function scrub(text) {
  let count = 0;
  let out = String(text || '');
  for (const [p, rep] of PATTERNS) out = out.replace(p, (...m) => { count++; return rep.replace(/\$(\d)/g, (_, i) => m[i]); });
  return { text: out, redactions: count };
}
module.exports = { scrub };
