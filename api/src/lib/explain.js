// Explainer, in order: 1) local open model + RAG, 2) Azure AI Foundry agent (adapter ready, needs Azure access), 3) deterministic text.
// Every path is READ-ONLY: it receives the request and rule results and can never approve, reject or deploy.
// Answers carry aiGenerated so the portal can label model output as such (transparency).
const DISCLAIMER = 'AI-generated explanation. It can be wrong; the rule results above are authoritative and only humans approve.';

// Deterministic answer, worded for where the request actually is.
function fallbackText(req, evaluation) {
  const failed = evaluation.results.filter((r) => r.status === 'fail');
  if (failed.length) return `Your request ${req.id} is blocked by ${failed.length} rule(s): ` + failed.map((f) => `${f.id} ${f.name} (${f.controls[0]}). Fix: ${f.fix}`).join(' | ');
  const required = evaluation.requiredApprovers;
  const decided = (d) => required.filter((a) => req.approvals?.[a]?.decision === d).join(', ');
  switch (req.status) {
    case 'rejected': return `Request ${req.id} passed all automated checks but was sent back by: ${decided('reject')}. Read their note on the request, change what they asked for and submit a new request.`;
    case 'approved': return `Request ${req.id} passed all automated checks and has every required approval (${required.join(', ')}). It is ready for the platform team to deploy.`;
    case 'deployed': return `Request ${req.id} passed all automated checks, was approved by ${required.join(', ')} and has been deployed (simulated) to ${req.deployment?.resourceGroup} in ${req.deployment?.region}.`;
    default: return `Request ${req.id} passed all automated checks. It is waiting on human approval from: ${required.filter((a) => !req.approvals?.[a]).join(', ')}.`;
  }
}

async function explain(req, evaluation, question) {
  question = question || 'Why is my request blocked and what should I change?';
  const fallback = fallbackText(req, evaluation);
  const deterministic = (source) => ({ source, aiGenerated: false, answer: fallback });

  if (process.env.RAG_ENABLED !== 'off') {
    try {
      const out = await require('./rag').answer(req, evaluation, question);
      if (out) return { source: 'rag-local', aiGenerated: true, disclaimer: DISCLAIMER, ...out };
    } catch (err) { console.warn('rag unavailable:', err.message); }
  }

  if (!process.env.FOUNDRY_PROJECT_ENDPOINT || !process.env.FOUNDRY_AGENT_ID) return deterministic('deterministic');
  try {
    const { AIProjectClient } = require('@azure/ai-projects');
    const { DefaultAzureCredential } = require('@azure/identity');
    const client = new AIProjectClient(process.env.FOUNDRY_PROJECT_ENDPOINT, new DefaultAzureCredential());
    const thread = await client.agents.threads.create();
    const { code: _code, ...summary } = req; // submitted code is not sent to the hosted agent; it only gets the request fields
    const content = `Question: ${question}\n\nRequest: ${JSON.stringify(summary)}\n\nRule results: ${JSON.stringify(evaluation)}`;
    await client.agents.messages.create(thread.id, 'user', content);
    const run = await client.agents.runs.createAndPoll(thread.id, process.env.FOUNDRY_AGENT_ID);
    if (run.status !== 'completed') throw new Error('run ' + run.status);
    const msgs = client.agents.messages.list(thread.id, { order: 'desc', limit: 1 });
    for await (const m of msgs) {
      const text = m.content.filter((c) => c.type === 'text').map((c) => c.text.value).join('\n');
      return { source: 'foundry', aiGenerated: true, disclaimer: DISCLAIMER, answer: text };
    }
    throw new Error('no reply');
  } catch (err) {
    return deterministic('deterministic (foundry unavailable: ' + err.message + ')');
  }
}
module.exports = { explain };
