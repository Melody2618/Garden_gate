// One-time: create the LaunchGate explainer agent in your Azure AI Foundry project and print its ID.
// Prereqs: `az login`, env FOUNDRY_PROJECT_ENDPOINT, and a deployed open model (env FOUNDRY_MODEL = your deployment name; default Phi-4. Llama-3.3-70B-Instruct and Mistral-Large-2411 also work with Agent Service).
import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential } from '@azure/identity';
import { readFileSync } from 'fs';
const client = new AIProjectClient(process.env.FOUNDRY_PROJECT_ENDPOINT, new DefaultAzureCredential());
const agent = await client.agents.createAgent(process.env.FOUNDRY_MODEL || 'Phi-4', { name: 'launchgate-explainer', instructions: readFileSync(new URL('./instructions.md', import.meta.url), 'utf8') });
console.log('FOUNDRY_AGENT_ID=' + agent.id);
