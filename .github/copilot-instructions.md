# LaunchGate: Copilot instructions
- Policy-aware deployment control plane for Mastercard (hackathon prototype). Agents prepare, deterministic rules decide, humans approve, nothing deploys without a human.
- Stack: Azure Static Web Apps (web/, React + Vite) with managed Azure Functions v4 API (api/, Node, JavaScript). Azure AI Foundry agent for explanations only (api/src/lib/explain.js). Bicep in infra/.
- Rules live in api/rules/rules.json. Each rule has an id GG-00x, a field check, a severity and public control IDs (PCI DSS 4.0.1, NIST SP 800-53 R5, CIS Microsoft Azure Foundations, Azure Policy). Never let the AI evaluate rules; api/src/lib/engine.js is the only place pass/fail is decided.
- Roles come from x-user / x-role headers in the prototype (stand-in for Entra ID claims). A requester can never approve their own request. Only status 'approved' may deploy.
- Keep it small: one template, 8 rules, three scenarios in api/scenarios. Do not add features outside README "Work split".
- No secrets in code. Foundry settings come from local.settings.json (gitignored) or SWA app settings.
