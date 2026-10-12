// One-time: embed rules.json locally and load it into the vector store (Supabase if configured, else in-memory, which is pointless to seed).
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/seed-policies.js
const { RULES } = require('../src/lib/engine');
const { ingestPolicies } = require('../src/lib/rag');
const { getStore } = require('../src/lib/rag/store');
if (getStore().kind === 'memory') console.warn('No SUPABASE_URL/SUPABASE_SERVICE_KEY set: seeding an in-memory store that exits with this process.');
ingestPolicies(RULES).then((n) => console.log(`seeded ${n} policy chunks into ${getStore().kind}`)).catch((e) => { console.error(e.message); process.exit(1); });
