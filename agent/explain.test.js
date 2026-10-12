// Tests for the agent guardrails, risk memo and Bicep parameters (api/src/lib/explain.js).
// Run: node agent/explain.test.js   (offline: Foundry is replaced by a fake `ask` function)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
delete process.env.FOUNDRY_PROJECT_ENDPOINT; delete process.env.FOUNDRY_AGENT_ID;
const api = path.join(__dirname, '..', 'api');
const { create, handle } = require(path.join(api, 'src/lib/core'));
const { explain, memo, toBicepParams, isOnTopic, unknownRuleIds, REFUSAL } = require(path.join(api, 'src/lib/explain'));
const { RULES } = require(path.join(api, 'src/lib/engine'));
const load = (n) => JSON.parse(fs.readFileSync(path.join(api, 'scenarios', n + '.json'), 'utf8'));
const fake = (text) => async () => text;

(async () => {
  const blocked = create(load('blocked'), 'eng');
  const ok = create(load('approved'), 'eng');
  const agentpay = create(load('agentpay'), 'eng');
  const blockedIds = blocked.evaluation.failed;

  // 1. Off-topic questions are refused without calling the model.
  let called = false;
  const spy = async () => { called = true; return 'x'; };
  for (const q of ['Write me a poem about Paris', 'What is the capital of France?', 'Tell me a joke', 'write a poem about data', 'why is the sky blue?']) {
    const out = await explain(blocked, blocked.evaluation, q, spy);
    assert.strictEqual(out.source, 'guardrail', q); assert.strictEqual(out.answer, REFUSAL);
  }
  assert.strictEqual(called, false, 'model must not be called for off-topic questions');
  for (const q of ['Why is it blocked?', 'What does GG-004 mean?', 'who has to approve this', 'what do I need to change?', 'why did this fail?', 'is the Agent Pay intent trail ok?', ''])
    assert.ok(isOnTopic(q), q);

  // 2. Only real rule IDs, including lookalikes. Every rule in rules.json counts as real.
  assert.deepStrictEqual(unknownRuleIds(RULES.map((r) => r.id).join(' ')), []);
  assert.deepStrictEqual(unknownRuleIds('fails GG-0012, GG-1, gg 099 and GG-004'), ['GG-0012', 'GG-1', 'GG-099']);
  const invented = await explain(blocked, blocked.evaluation, 'why blocked?', fake('Blocked by GG-002 and GG-042.'));
  assert.match(invented.source, /unknown rule GG-042/); assert.ok(!invented.answer.includes('GG-042'));
  assert.strictEqual((await explain(blocked, blocked.evaluation, 'why blocked?', fake('Blocked by GG-002 (TLS). Fix: require HTTPS.'))).source, 'foundry');

  // 3. Foundry down or not configured: the deterministic answer names every failed rule.
  assert.match((await explain(blocked, blocked.evaluation, 'why blocked?', async () => { throw new Error('timeout'); })).source, /foundry unavailable: timeout/);
  const offline = await explain(blocked, blocked.evaluation, 'why blocked?');
  assert.strictEqual(offline.source, 'deterministic');
  for (const id of blockedIds) assert.ok(offline.answer.includes(id), id);

  // 4. Risk memo through the existing explain operation (no other API file changes).
  const viaApi = await handle('explain', { req: ok, question: 'Draft the risk memo' }, { 'x-role': 'security' });
  assert.strictEqual(viaApi.status, 200);
  assert.match(viaApi.body.source, /^risk memo · deterministic$/);
  assert.match(viaApi.body.answer, /^RISK MEMO REQ-/);
  assert.match(viaApi.body.answer, /does not recommend approval/);
  assert.ok(viaApi.body.memo.markdown.includes('## Who must approve'));
  assert.ok(viaApi.body.req.audit.some((a) => a.action === 'explained'), 'memo is audited');
  const mb = await memo(blocked, blocked.evaluation);
  assert.deepStrictEqual(mb.memo.facts.failed.map((f) => f.id).sort(), [...blockedIds].sort());
  assert.match(mb.memo.facts.recommendation, /Return to requester/); assert.strictEqual(mb.memo.facts.deployment, null);
  const map = await memo(agentpay, agentpay.evaluation);
  assert.ok(map.memo.facts.humanHandoffs.length >= 1); assert.match(map.answer, /Skyline Airlines/);
  assert.strictEqual(map.memo.facts.deployment.resourceGroup, 'rg-agent-pay-airline-checkout-dev');

  // 5. The memo never carries an AI recommendation to approve, reject or deploy. Facts about who must approve are fine.
  for (const t of ['This request should be approved.', 'This request can be approved.', 'It should be rejected.', 'I recommend rejecting it.', 'It is safe to deploy.'])
    assert.match((await memo(ok, ok.evaluation, fake(t))).source, /humans decide/, t);
  assert.strictEqual((await memo(ok, ok.evaluation, fake('Security and platform must approve this request.'))).source, 'risk memo · foundry');
  assert.match((await memo(ok, ok.evaluation, fake('Passes GG-001 through GG-012.'))).source, /unknown rule GG-012/);
  const drafted = await memo(ok, ok.evaluation, fake('Merchant onboarding handles confidential data at medium risk; security and platform must sign off.'));
  assert.ok(drafted.answer.includes(drafted.memo.summary));

  // 6. Bicep parameters match the template's params exactly and re-check what the rules check.
  const bicep = fs.readFileSync(path.join(__dirname, '..', 'infra', 'templates', 'dev-environment.bicep'), 'utf8');
  const declared = [...bicep.matchAll(/^param (\w+) /gm)].map((m) => m[1]).sort();
  for (const name of ['agentpay', 'approved', 'compliant']) {
    const req = create(load(name), 'eng');
    assert.deepStrictEqual(Object.keys(toBicepParams(req).parameters.parameters).sort(), declared, name);
  }
  assert.strictEqual(toBicepParams(agentpay).parameters.parameters.program.value, 'agent-pay');
  assert.throws(() => toBicepParams({ ...ok, region: 'westeurope' }), /GG-003/);
  assert.throws(() => toBicepParams({ ...ok, costCenter: '' }), /GG-006/);
  assert.throws(() => toBicepParams({ ...ok, projectName: 'x'.repeat(41) }), /longer than 40/);
  assert.strictEqual(toBicepParams({ ...ok, projectName: 'Merchant Onboarding!' }).parameters.parameters.projectName.value, 'merchant-onboarding');
  const tooLong = create({ ...load('approved'), projectName: 'merchant-onboarding-platform-for-partner-banks-v2' }, 'eng');
  assert.match((await memo(tooLong, tooLong.evaluation)).answer, /cannot be built/);

  console.log('agent tests passed: off-topic refused, unknown and lookalike rule IDs rejected, offline fallback, memo via explain (audited, no decision), Agent Pay memo, params match template');
})().catch((e) => { console.error(e); process.exit(1); });
