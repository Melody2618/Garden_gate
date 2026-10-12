// One-time: create the LaunchGate explainer agent in your Azure AI Foundry project and print its ID.
// Prereqs: `az login`, env FOUNDRY_PROJECT_ENDPOINT, and a deployed model (env FOUNDRY_MODEL, default gpt-4o-mini).
import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential } from '@azure/identity';
import { readFileSync } from 'fs';
const client = new AIProjectClient(process.env.FOUNDRY_PROJECT_ENDPOINT, new DefaultAzureCredential());
const agent = await client.agents.createAgent(process.env.FOUNDRY_MODEL || 'gpt-4o-mini', { name: 'launchgate-explainer', instructions: readFileSync(new URL('./instructions.md', import.meta.url), 'utf8') });
console.log('FOUNDRY_AGENT_ID=' + agent.id);
