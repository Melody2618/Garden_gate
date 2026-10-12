// Explainer + risk memo + deployment parameters. Facts always come from the rule engine and readiness model;
// the Azure AI Foundry agent only writes plain-language wording. The agent is READ-ONLY: it never approves,
// rejects or deploys. Everything here is reached through the existing `explain` operation, so no other API file changes.
//
// Guardrails enforced in code (not just in the prompt):
//   1. Off-topic questions are refused before the model is called.
//   2. Any rule ID the agent mentions must exist in rules.json, or the deterministic answer is used instead.
//   3. A memo summary that tells the approver what to decide is discarded. Humans decide.
//   4. If no model is available or it fails, a deterministic answer is returned, so the demo works offline.
// Answers carry aiGenerated so the portal can label model output as such (transparency). Submitted code never goes to
// Foundry (agentView has no code); only the local model sees it, fenced as untrusted (rag/index.js).
//
// Ask "draft the risk memo" in the portal's agent box to get the memo for a request.
const { RULES } = require('./engine');
const { fail } = require('./errors');
const DISCLAIMER = 'AI-generated explanation. It can be wrong; the rule results above are authoritative and only humans approve.';

const RULE_IDS = new Set(RULES.map((r) => r.id));
const REFUSAL = "I can only explain this request's policy results.";

// Words that show the question is about this request. Anything else is refused without calling the model.
const ON_TOPIC = /\b(GG-?\d+|rule|rules|block|blocked|fail|failed|pass|approv\w*|reject\w*|deploy\w*|fix|change|status|risk|tier|score|secur\w*|polic\w*|control|complian\w*|pci|nist|cis|region|encrypt\w*|tls|https|endpoint|public|logging|logs?|owner|cost|identity|secret|credential|request|memo|evidence|handoff|wait\w*|agent\s?pay|intent|partner|contract|certif\w*|program)\b/i;
const MEMO = /\b(risk\s+)?memo\b|\bevidence\s+pack\b/i;
// "Security must approve" is a fact and is allowed; "this can be approved" is a decision and is not.
const DECISION = /\b(should|can|could|may)\s+(now\s+)?be\s+(approved|rejected|deployed)\b|\brecommend\w*\s+(that\s+)?(it\s+|this\s+)?(be\s+)?(approv|reject|deploy)\w*|\b(safe|ok|okay|fine)\s+to\s+(approve|reject|deploy)\b|\bi\s+would\s+(approve|reject)\b/i;

function isOnTopic(question) {
  if (!question || !question.trim()) return true; // empty question = default "why is it blocked"
  return ON_TOPIC.test(question);
}

// Rule IDs in a text that are not real rules, including lookalikes such as GG-1 or GG-0012. Empty = all valid.
function unknownRuleIds(text) {
  const cited = ((text || '').match(/\bGG[-\s]?\d+\b/gi) || []).map((m) => 'GG-' + m.replace(/\D/g, ''));
  return [...new Set(cited)].filter((id) => !RULE_IDS.has(id));
}

// ---------- Deployment parameters for infra/templates/dev-environment.bicep ----------
// Parameter names must match the template's `param` lines. Values are re-checked so a request can never produce
// a deployment the rules would have blocked.
const TEMPLATE = 'infra/templates/dev-environment.bicep';
const ALLOWED_REGIONS = ['eastus', 'eastus2', 'centralus']; // same list as rule GG-003 and the template's @allowed
const DATA_CLASSES = ['internal', 'confidential', 'restricted'];
const MAX_NAME = 40; // keeps 'app-<name>-dev' and 'log-<name>-dev' within Azure name limits; storage is shortened in the template
const bad = (msg) => fail(400, msg);

function cleanProjectName(name) {
  const slug = String(name || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw bad('projectName is required');
  if (slug.length > MAX_NAME) throw bad(`projectName "${name}" is longer than ${MAX_NAME} characters`);
  return slug;
}

function toBicepParams(req) {
  if (!ALLOWED_REGIONS.includes(req.region)) throw bad(`region ${req.region} is not allowed (rule GG-003)`);
  if (!DATA_CLASSES.includes(req.dataClass)) throw bad(`unknown dataClass ${req.dataClass}`);
  if (!req.owner || !req.costCenter) throw bad('owner and costCenter are required (rule GG-006)');
  const projectName = cleanProjectName(req.projectName);
  const resourceGroup = `rg-${projectName}-dev`;
  const fileName = `${req.id || projectName}.parameters.json`;
  return {
    template: TEMPLATE,
    resourceGroup,
    parametersFile: fileName,
    parameters: {
      $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
      contentVersion: '1.0.0.0',
      parameters: {
        location: { value: req.region },
        projectName: { value: projectName },
        owner: { value: req.owner },
        costCenter: { value: req.costCenter },
        dataClass: { value: req.dataClass },
        program: { value: req.program || 'internal' },
      },
    },
    command: `az deployment group create -g ${resourceGroup} -f ${TEMPLATE} -p @${fileName}`,
  };
}

// ---------- Foundry ----------
async function askFoundry(content) {
  const { AIProjectClient } = require('@azure/ai-projects');
  const { DefaultAzureCredential } = require('@azure/identity');
  const client = new AIProjectClient(process.env.FOUNDRY_PROJECT_ENDPOINT, new DefaultAzureCredential());
  const thread = await client.agents.threads.create();
  await client.agents.messages.create(thread.id, 'user', content);
  const run = await client.agents.runs.createAndPoll(thread.id, process.env.FOUNDRY_AGENT_ID);
  if (run.status !== 'completed') throw new Error('run ' + run.status);
  for await (const m of client.agents.messages.list(thread.id, { order: 'desc', limit: 1 })) {
    const text = m.content.filter((c) => c.type === 'text').map((c) => c.text.value).join('\n').trim();
    if (text) return text;
  }
  throw new Error('no reply');
}
const foundryConfigured = () => Boolean(process.env.FOUNDRY_PROJECT_ENDPOINT && process.env.FOUNDRY_AGENT_ID);

// Only what the agent needs: request settings and rule results. No audit log, no approver identities.
const REQUEST_FIELDS = ['id', 'status', 'program', 'projectName', 'partnerName', 'contractRef', 'intentAuditTrail', 'dataClass', 'region', 'publicEndpoint', 'authMethod', 'tlsOnly', 'encryptionAtRest', 'loggingEnabled', 'owner', 'costCenter'];
const agentView = (req, evaluation) => ({
  request: Object.fromEntries(REQUEST_FIELDS.filter((k) => k in req).map((k) => [k, req[k]])),
  verdict: evaluation.verdict,
  results: evaluation.results.filter((r) => r.status !== 'skipped'),
  requiredApprovers: evaluation.requiredApprovers,
  risk: { score: evaluation.model.riskScore, tier: evaluation.model.tier, factors: evaluation.model.factors.filter((f) => f.points > 0) },
  validRuleIds: [...RULE_IDS],
});

// ---------- Explanation ----------
// Deterministic answer, worded for where the request actually is.
function deterministicExplanation(req, evaluation) {
  const failed = evaluation.results.filter((r) => r.status === 'fail');
  if (failed.length) return `Request ${req.id} is blocked by ${failed.length} rule(s): ` + failed.map((f) => `${f.id} ${f.name} (${f.controls[0]}). Fix: ${f.fix}`).join(' | ');
  const required = evaluation.requiredApprovers;
  const decided = (d) => required.filter((a) => req.approvals?.[a]?.decision === d).join(', ');
  switch (req.status) {
    case 'rejected': return `Request ${req.id} passed all automated checks but was sent back by: ${decided('reject')}. Read their note on the request, change what they asked for and submit a new request.`;
    case 'approved': return `Request ${req.id} passed all automated checks and has every required approval (${required.join(', ')}). It is ready for the platform team to deploy.`;
    case 'deployed': return `Request ${req.id} passed all automated checks, was approved by ${required.join(', ')} and has been deployed (simulated) to ${req.deployment?.resourceGroup} in ${req.deployment?.region}.`;
    default: return `Request ${req.id} passed all automated checks. It is waiting on human approval from: ${required.filter((a) => !req.approvals?.[a]).join(', ')}.`;
  }
}

// Called by core.js for the `explain` operation. Order: 1) local open model + RAG (when RAG_ENABLED is not 'off'),
// 2) Azure AI Foundry agent, 3) deterministic text. _ask is injectable for tests and replaces both model paths.
async function explain(req, evaluation, question, _ask) {
  if (!isOnTopic(question)) return { source: 'guardrail', aiGenerated: false, answer: REFUSAL };
  if (MEMO.test(question || '')) return memo(req, evaluation, _ask);
  question = question || 'Why is my request blocked and what should I change?';
  const fallback = deterministicExplanation(req, evaluation);
  const deterministic = (source) => ({ source, aiGenerated: false, answer: fallback });

  if (!_ask && process.env.RAG_ENABLED !== 'off') {
    try {
      const out = await require('./rag').answer(req, evaluation, question);
      if (out) return { source: 'rag-local', aiGenerated: true, disclaimer: DISCLAIMER, ...out };
    } catch (err) { console.warn('rag unavailable:', err.message); }
  }

  const ask = _ask || (foundryConfigured() ? askFoundry : null);
  if (!ask) return deterministic('deterministic');
  try {
    const content = `MODE: explain\nQuestion: ${question}\n\nData: ${JSON.stringify(agentView(req, evaluation))}`;
    const answer = await ask(content);
    const unknown = unknownRuleIds(answer);
    if (unknown.length) return deterministic(`deterministic (agent cited unknown rule ${unknown.join(', ')})`);
    return { source: 'foundry', aiGenerated: true, disclaimer: DISCLAIMER, answer };
  } catch (err) {
    return deterministic('deterministic (foundry unavailable: ' + err.message + ')');
  }
}

// ---------- Risk memo ----------
// Every fact is computed here; the agent writes only the summary paragraph.
function memoFacts(req, evaluation) {
  const m = evaluation.model;
  const failed = evaluation.results.filter((r) => r.status === 'fail');
  let deployment = null;
  if (!failed.length) { try { deployment = toBicepParams(req); } catch (e) { deployment = { error: e.message }; } }
  let recommendation;
  if (failed.length) recommendation = `Return to requester. ${failed.length} blocking rule(s) must be fixed before any human review.`;
  else if (deployment?.error && req.status === 'awaiting-approval') recommendation = `Passed the rules, but no deployment plan can be built (${deployment.error}). Ask the requester to fix this before approving, or the deployment will fail.`;
  else if (req.status === 'awaiting-approval') recommendation = `Ready for human review by ${evaluation.requiredApprovers.join(', ')}. The decision belongs to the approvers; this memo does not recommend approval.`;
  else recommendation = `Status is ${req.status}. No action needed from this memo.`;
  return {
    requestId: req.id, projectName: req.projectName, program: req.program || 'internal', partnerName: req.partnerName, status: req.status,
    owner: req.owner || '(missing)', costCenter: req.costCenter || '(missing)', dataClass: req.dataClass, region: req.region,
    risk: { score: m.riskScore, tier: m.tier, label: m.tierLabel, factors: m.factors.filter((f) => f.points > 0) },
    failed: failed.map((r) => ({ id: r.id, name: r.name, control: r.controls[0], fix: r.fix })),
    approvalRules: evaluation.results.filter((r) => r.status === 'approval-required').map((r) => ({ id: r.id, name: r.name, approver: r.approver, control: r.controls[0] })),
    passed: evaluation.results.filter((r) => r.status === 'pass').map((r) => r.id),
    requiredApprovers: evaluation.requiredApprovers,
    compliance: m.compliance.map((c) => c.id),
    humanHandoffs: m.handoffs.filter((h) => h.mode === 'human').map((h) => h.name),
    deployment,
    recommendation,
  };
}

function deterministicSummary(f) {
  const what = f.partnerName ? `${f.projectName} (${f.program}, partner ${f.partnerName})` : f.projectName;
  if (f.failed.length) return `${what} is blocked by ${f.failed.map((r) => r.id).join(', ')}. It handles ${f.dataClass} data in ${f.region} and scores ${f.risk.score}/100 (${f.risk.tier}). It cannot reach an approver until those rules pass.`;
  return `${what} passed all ${f.passed.length} automated checks for ${f.dataClass} data in ${f.region} and scores ${f.risk.score}/100 (${f.risk.tier}). It needs sign-off from ${f.requiredApprovers.join(' and ')}.`;
}

// Markdown version, for a future memo view or export.
function memoMarkdown(f, summary) {
  const L = [`# Risk memo · ${f.requestId} · ${f.projectName}`, `Status: **${f.status}** · Risk ${f.risk.score}/100 (${f.risk.label}) · Data: ${f.dataClass} · Region: ${f.region}`, `Owner: ${f.owner} · Cost center: ${f.costCenter}`, '', '## Summary', summary, '', '## Risk factors'];
  L.push(...(f.risk.factors.length ? f.risk.factors.map((x) => `- ${x.factor}: +${x.points} (${x.because})`) : ['- None raised.']));
  L.push('', '## Blocking rules', ...(f.failed.length ? f.failed.map((r) => `- ${r.id} ${r.name} · ${r.control} · Fix: ${r.fix}`) : ['- None. All automated checks passed.']));
  if (f.approvalRules.length) L.push('', '## Rules that require a human', ...f.approvalRules.map((r) => `- ${r.id} ${r.name} · ${r.approver} approver · ${r.control}`));
  L.push('', '## Passed rules', f.passed.join(', ') || 'None.', '', '## Who must approve', f.requiredApprovers.join(', '), '', '## Frameworks in scope', f.compliance.join(', '), '', '## Handoffs kept human', f.humanHandoffs.join(', ') || 'None.');
  if (f.deployment?.error) L.push('', '## Deployment plan', `Cannot be built: ${f.deployment.error}`);
  else if (f.deployment) L.push('', '## Deployment plan', `Template: ${f.deployment.template} · Resource group: ${f.deployment.resourceGroup}`, '`' + f.deployment.command + '`');
  L.push('', '## Recommendation', f.recommendation, '', '_Facts in this memo come from the deterministic rule engine. Any AI-drafted wording is read-only; humans make every decision._');
  return L.join('\n');
}

// One-paragraph version that reads well in the portal's existing answer box.
function memoText(f, summary) {
  const parts = [`RISK MEMO ${f.requestId}. ${summary}`];
  parts.push(`Risk: ${f.risk.score}/100, ${f.risk.label.toLowerCase()}` + (f.risk.factors.length ? ` (${f.risk.factors.map((x) => `${x.factor} +${x.points}`).join(', ')}).` : '.'));
  parts.push(f.failed.length ? `Blocking: ${f.failed.map((r) => `${r.id} ${r.name} (${r.control}); fix: ${r.fix}`).join(' ')}` : `Blocking: none; passed ${f.passed.join(', ')}.`);
  if (f.approvalRules.length) parts.push(`Needs a human: ${f.approvalRules.map((r) => `${r.id} (${r.approver})`).join(', ')}.`);
  parts.push(`Must approve: ${f.requiredApprovers.join(', ')}. Frameworks: ${f.compliance.join(', ')}. Kept human: ${f.humanHandoffs.join(', ') || 'none'}.`);
  if (f.deployment?.error) parts.push(`Deployment plan: cannot be built (${f.deployment.error}).`);
  else if (f.deployment) parts.push(`Deployment plan: ${f.deployment.template} into ${f.deployment.resourceGroup}.`);
  parts.push(`Next step: ${f.recommendation}`);
  return parts.join(' ');
}

async function memo(req, evaluation, _ask) {
  const facts = memoFacts(req, evaluation);
  let summary = deterministicSummary(facts), source = 'deterministic';
  const ask = _ask || (foundryConfigured() ? askFoundry : null);
  if (ask) {
    try {
      const text = await ask(`MODE: memo\nWrite the summary paragraph for this risk memo.\n\nFacts: ${JSON.stringify(facts)}\n\nValid rule IDs: ${[...RULE_IDS].join(', ')}`);
      const unknown = unknownRuleIds(text);
      if (unknown.length) source = `deterministic (agent cited unknown rule ${unknown.join(', ')})`;
      else if (DECISION.test(text)) source = 'deterministic (agent recommended a decision; humans decide)';
      else { summary = text; source = 'foundry'; }
    } catch (err) { source = 'deterministic (foundry unavailable: ' + err.message + ')'; }
  }
  const ai = source === 'foundry';
  return { source: 'risk memo · ' + source, aiGenerated: ai, ...(ai && { disclaimer: DISCLAIMER }), answer: memoText(facts, summary), memo: { facts, summary, markdown: memoMarkdown(facts, summary) } };
}

module.exports = { explain, memo, toBicepParams, isOnTopic, unknownRuleIds, REFUSAL };
