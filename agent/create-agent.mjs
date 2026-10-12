// Create (or update) the LaunchGate explainer agent in your Azure AI Foundry project and print its ID.
// Prereqs: `az login`, env FOUNDRY_PROJECT_ENDPOINT, and a deployed open model (env FOUNDRY_MODEL = your deployment name;
// default Phi-4. Llama-3.3-70B-Instruct and Mistral-Large-2411 also work with Agent Service).
// Re-run after editing instructions.md: if FOUNDRY_AGENT_ID is already set, the existing agent is updated in place,
// so the ID in your app settings does not change.
import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential } from '@azure/identity';
import { readFileSync } from 'fs';

if (!process.env.FOUNDRY_PROJECT_ENDPOINT) { console.error('Set FOUNDRY_PROJECT_ENDPOINT (project Overview page in the Foundry portal).'); process.exit(1); }
const client = new AIProjectClient(process.env.FOUNDRY_PROJECT_ENDPOINT, new DefaultAzureCredential());
const model = process.env.FOUNDRY_MODEL || 'Phi-4';
const options = { name: 'launchgate-explainer', instructions: readFileSync(new URL('./instructions.md', import.meta.url), 'utf8'), temperature: 0.1 };

let agent;
if (process.env.FOUNDRY_AGENT_ID) {
  agent = await client.agents.updateAgent(process.env.FOUNDRY_AGENT_ID, { model, ...options });
  console.log('Updated agent instructions.');
} else {
  agent = await client.agents.createAgent(model, options);
}
console.log('FOUNDRY_AGENT_ID=' + agent.id);
