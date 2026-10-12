// Explainer: asks the Azure AI Foundry agent when configured, otherwise returns a deterministic explanation.
// The agent is READ-ONLY: it receives the request and rule results and can never approve or deploy.
async function explain(req, evaluation, question) {
  const failed = evaluation.results.filter((r) => r.status === 'fail');
  const fallback = failed.length
    ? `Your request ${req.id} is blocked by ${failed.length} rule(s): ` + failed.map((f) => `${f.id} ${f.name} (${f.controls[0]}). Fix: ${f.fix}`).join(' | ')
    : `Request ${req.id} passed all automated checks. It is waiting on human approval from: ${evaluation.requiredApprovers.join(', ')}.`;
  if (!process.env.FOUNDRY_PROJECT_ENDPOINT || !process.env.FOUNDRY_AGENT_ID) return { source: 'deterministic', answer: fallback };
  try {
    const { AIProjectClient } = require('@azure/ai-projects');
    const { DefaultAzureCredential } = require('@azure/identity');
    const client = new AIProjectClient(process.env.FOUNDRY_PROJECT_ENDPOINT, new DefaultAzureCredential());
    const thread = await client.agents.threads.create();
    const content = `Question: ${question || 'Why is my request blocked and what should I change?'}\n\nRequest: ${JSON.stringify(req)}\n\nRule results: ${JSON.stringify(evaluation)}`;
    await client.agents.messages.create(thread.id, 'user', content);
    const run = await client.agents.runs.createAndPoll(thread.id, process.env.FOUNDRY_AGENT_ID);
    if (run.status !== 'completed') throw new Error('run ' + run.status);
    const msgs = client.agents.messages.list(thread.id, { order: 'desc', limit: 1 });
    for await (const m of msgs) {
      const text = m.content.filter((c) => c.type === 'text').map((c) => c.text.value).join('\n');
      return { source: 'foundry', answer: text };
    }
    throw new Error('no reply');
  } catch (err) {
    return { source: 'deterministic (foundry unavailable: ' + err.message + ')', answer: fallback };
  }
}
module.exports = { explain };
