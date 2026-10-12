# AI guardrails and evidence (Build Readiness checklist)

LaunchGate uses AI in one place: an Azure AI Foundry agent (open model, Phi-4 by default) that writes plain-language explanations and the summary paragraph of the risk memo. It never decides anything. Every guardrail below is enforced in code in `api/src/lib/explain.js` and covered by `agent/explain.test.js`, so it holds even if the model ignores its prompt.

| Customer concern / checklist item | How LaunchGate handles it | Test |
|---|---|---|
| Humans must make the decision | The agent is read-only. The memo's next-step line is computed in code and never recommends approval. An AI summary that recommends approving, rejecting or deploying is discarded. | §5 |
| AI must not make things up | Any rule ID the agent cites, including lookalikes like GG-1, must exist in `rules.json`. Otherwise the deterministic answer is shown and the source label says why. New rules are picked up automatically. | §2 |
| Stay on task | Off-topic questions are refused before the model is called: no tokens spent, nothing to leak. | §1 |
| Works when AI is unavailable | No Foundry settings, a timeout, or an error all fall back to a deterministic answer naming every failed rule. | §3 |
| Minimal data to the model | The agent receives request settings and rule results only, not the audit log or approver identities. | code review |
| Prompt injection via request fields | Instructions tell the agent to treat field values as data; the citation and decision checks catch it if it doesn't. | §2, §5 |
| Evidence for approvers | Ask "draft the risk memo" in the portal: risk score and factors, blocking rules with the control each cites, rules needing a human, frameworks in scope, handoffs kept human, deployment plan. Audited like any explanation. | §4 |
| Approvers don't waste time on requests that can't deploy | If a request passes the rules but no valid deployment plan can be built, the memo says so before anyone approves. | §6 |
| Deploy only what the rules allowed | Deployment parameters come from the request and are re-checked (approved region, owner and cost center, valid name). Their names match the template's params exactly. | §6 |

## Commands

- Run the tests: `node agent/explain.test.js`
- Make a parameters file: `node infra/templates/make-params.js api/scenarios/agentpay.json > agentpay.parameters.json`
- Update the agent after editing `agent/instructions.md`: re-run `node agent/create-agent.mjs` with `FOUNDRY_AGENT_ID` set. The existing agent is updated in place.
