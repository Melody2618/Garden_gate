# LaunchGate — Team Garden State × Mastercard (LEAD ASPIRE 2026)

Policy-aware deployment control plane. One request replaces ~12 handoffs. A deterministic readiness model scores risk and decides which handoffs stay human, rules decide pass/fail, an Azure AI Foundry agent running an open model (Phi-4) explains and drafts, humans approve, nothing deploys without a human.

**AI in the stack:** readiness model = transparent weighted scoring (`api/src/lib/model.js`); explainer/risk memo = Azure AI Foundry Agent Service on an open model from the Foundry catalog (Phi-4 default; Llama 3.3 or Mistral Large swap in by changing `FOUNDRY_MODEL`); deterministic fallback when Foundry is not configured. No Hugging Face or external model hosts.

**Stack:** Azure Static Web Apps (React portal in `web/`) + managed Azure Functions API (`api/`, Node) + Azure AI Foundry agent (`agent/`) + Bicep (`infra/`). Built with GitHub Copilot / Claude.

## Run it locally (5 min)
```bash
npm install --prefix web && npm install --prefix api
npm test --prefix api                      # rule engine, RAG and security tests
npm install -g @azure/static-web-apps-cli azure-functions-core-tools@4
swa start                                   # portal http://localhost:4280 (web on 5173 + api on 7071)
```
No Foundry yet? The explainer falls back to a deterministic answer, so the whole demo works offline.

The portal asks for a password the first time you use each demo account. Locally every account accepts `launchgate-demo`; a hosted deployment refuses it and uses the passwords you set (see Deploy).

## Demo path (what we show, 5 min)
1. Engineer loads **compliant** scenario → Submit → all 8 rules pass → `awaiting-approval` (platform only).
2. Load **blocked** → Submit → 5 rules fail, each names its control (PCI DSS 4.0.1 / NIST 800-53 / CIS Azure / Azure Policy) and a fix → ask the Foundry agent "why is it blocked?".
3. Load **needs security approval** (confidential data) → switch role to *Security approver* → Approve → switch to *Platform approver* → Approve → `approved` → **Deploy (simulated Azure)** from the Copilot-drafted Bicep template → audit log + metrics tiles (12 handoffs → 1).
Also show: requester cannot approve own request (403), deploy before approval is refused (409). Restricted (cardholder) data that passes the rules also needs the *Compliance officer*.

## Work split (2h30, everyone commits to `main` via small PRs; Claude/Copilot on each laptop)
| Who | Owns | Files | Done when |
|---|---|---|---|
| **Azra** (lead/architect) | Azure + Foundry setup, SWA deploy, SOW→demo traceability, pitch | `infra/`, `agent/`, `.github/workflows`, this README | SWA live URL; `FOUNDRY_AGENT_ID` set; demo script rehearsed |
| **Melanie** (portal) | Polish `web/`: status pills, approvals inbox view, metrics tiles, Mastercard-style look, error states | `web/src/*` | All 3 scenarios click through on `swa start` without console errors |
| **Jayden** (API + rules) | Harden `api/`: validation, Cosmos DB persistence (optional), audit export endpoint, 2 more rules if time | `api/src/*`, `api/rules/rules.json`, `api/test` | `npm test` green; approve/deploy guards return 403/409; audit has every transition |
| **Adrian** (AI + evidence) | Foundry agent prompt + risk-memo endpoint (`POST /requests/{id}/memo`), Bicep template params from request, Build Readiness checklist mapping | `agent/`, `api/src/lib/explain.js`, `infra/templates/` | Agent answers cite only real rule IDs; refuses off-topic; memo shown in portal |

Branch naming: `melanie/portal`, `jayden/api`, `adrian/agent`, `azra/infra`. Rebase on `main` often; nobody force-pushes.

## Deploy on Vercel (2 min)
vercel.com → Add New Project → import `Melody2618/Garden_gate` → **Root Directory must stay `.` (repo root)**, Framework Preset `Other` → Deploy. `vercel.json` handles install, build and the `/api/gate` function. Under Settings → Environment Variables, add these **before the first sign-in**, or sign-in returns 503:
- `LAUNCHGATE_SECRET`: a long random string (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Every serverless instance must share it.
- `DEMO_PASSWORDS`: one password per account, e.g. `{"demo.engineer":"…","sec.reviewer":"…","platform.lead":"…"}`, so the person holding the requester password cannot also approve. Or set `DEMO_PASSWORD` for one shared password. The published `launchgate-demo` is never accepted when hosted.

Add `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_AGENT_ID`, `FOUNDRY_MODEL` when Foundry is ready. Using Supabase? Run `api/db/schema.sql` in the Supabase SQL editor, and run it again after pulling changes: it upgrades existing tables in place.

## Azure setup (~20 min)
1. **Azure for Students** → https://azure.microsoft.com/free/students → sign in with your school account.
2. **Resource group** `lead` (region `eastus2`).
3. **Static Web App**: Portal → Create → Static Web App → Free → source GitHub `Melody2618/Garden_gate`, branch `main`, app location `web`, api location `api`, output `dist`. Azure adds the deploy token secret to the repo (our workflow in `.github/workflows` uses it).
4. **Foundry** (from the starter-kit PDF): Portal → search **Foundry** → Create → resource group `lead` → name `lead-foundry` → project name `launchgate` → Review + create (2–3 min) → **Go to Foundry portal**.
5. In Foundry: **Models + endpoints → Deploy model → search `Phi-4`** (Microsoft's open-weights model; serverless, pay-per-token, no quota request). Keep the deployment name `Phi-4`. Open alternatives that also work with Agent Service: `Llama-3.3-70B-Instruct`, `Mistral-Large-2411`. Put the deployment name in `FOUNDRY_MODEL`. Copy the **project endpoint** from the project Overview (looks like `https://lead-foundry.services.ai.azure.com/api/projects/launchgate`).
6. Create the agent either in **Agents → New agent** (paste `agent/instructions.md`, pick the model, copy its ID `asst_…`) or from your laptop:
   ```bash
   az login
   export FOUNDRY_PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
   cd api && npm install && node ../agent/create-agent.mjs     # prints FOUNDRY_AGENT_ID=asst_...
   ```
7. Put both values in `api/local.settings.json` (copy from `.sample`) for local runs, and in the Static Web App → **Settings → Environment variables** for the live site, together with `LAUNCHGATE_SECRET` and `DEMO_PASSWORDS` (or `DEMO_PASSWORD`) as described under Deploy on Vercel; without them nobody can sign in. Your identity needs the **Azure AI User** role on the Foundry resource (Access control → Add role assignment). For the live SWA API, enable the managed identity on the Static Web App and give it the same role.
8. Test: ask the agent in the portal; the answer source changes from `deterministic` to `foundry`.

## Security & governance (maps to the starter-kit review)
Full detail in [docs/security.md](docs/security.md). Identity: signed tokens, roles decided by the server (`api/src/lib/auth.js`), per-account passwords and sign-in lockout in the prototype, Entra ID via SWA auth in pilot; separation of duties and concurrent-change protection enforced in `api/src/lib/core.js` and `api/src/lib/db.js`. Secrets: none in code, Foundry via `DefaultAzureCredential`. Data: synthetic requests only, no personal data. Logging: append-only audit, no secrets logged. AI: read-only agent, cites rule IDs only, deterministic fallback. Governance: rules in `api/rules/rules.json` cite public controls; Mastercard's catalogue replaces them in a pilot.

## Customer concern → solution mapping (Build Readiness checklist)
| # | Concern (Discovery) | Where it is addressed |
|---|---|---|
| 1 | 6–8 months, ~12 handoffs, ideal 1 | One request; metrics tile 12 → 1; audit counts transitions |
| 2 | "Deployment is not enough: policy and orchestration" | Rule engine + workflow states submitted → blocked / awaiting-approval → approved → deployed |
| 3 | Guardrails cannot be bypassed | Only `approved` can deploy (409); blocked requests cannot be approved |
| 4 | Human review is important | Role-based approvals; AI agent is read-only |
| 5 | Redo when someone leaves | Rules and workflow are code in this repo; audit log is the record |
