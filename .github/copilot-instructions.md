# LaunchGate: Copilot instructions
- Policy-aware deployment control plane for Mastercard (hackathon prototype). Agents prepare, deterministic rules decide, humans approve, nothing deploys without a human.
- Stack: Azure Static Web Apps (web/, React + Vite) with managed Azure Functions v4 API (api/, Node, JavaScript). Azure AI Foundry agent for explanations only (api/src/lib/explain.js). Bicep in infra/.
- Rules live in api/rules/rules.json. Each rule has an id GG-00x, a field check, a severity and public control IDs (PCI DSS 4.0.1, NIST SP 800-53 R5, CIS Microsoft Azure Foundations, Azure Policy). Never let the AI evaluate rules; api/src/lib/engine.js is the only place pass/fail is decided.
- Roles are decided by the server from a signed token (api/src/lib/auth.js; stand-in for Entra ID claims), never sent by the client. Passwords come from app settings (DEMO_PASSWORDS / DEMO_PASSWORD); never hard-code one in web/. A requester can never approve their own request. Only status 'approved' may deploy.
- Change requests only through getDb().updateRequest after load(): it refuses (409) a save based on a stale copy. Host adapters call respond() in api/src/lib/core.js, which maps and logs errors in one place.
- Keep it small: one template, 8 rules, three scenarios in api/scenarios. Do not add features outside README "Work split".
- No secrets in code. Foundry settings come from local.settings.json (gitignored) or SWA app settings.
