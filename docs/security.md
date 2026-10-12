# LaunchGate: Security & Governance

How LaunchGate protects the customer, mapped to the LEAD ASPIRE Security & Governance checklist. Every claim points to the code that enforces it. Prototype limits are stated plainly at the end.

**Core principle:** agents prepare, deterministic rules decide, humans approve, nothing deploys without a human. The server is the only source of truth.

## Architecture in one paragraph
The portal sends an operation and a request **id** to one API entry point (`api/src/lib/core.js`). Every call except login carries a signed token; the server verifies it, looks up the user's role itself, checks the role may perform the operation, loads the request from the server-side store, applies the change, saves it only if nobody else changed the request in between, and appends an audit entry. The rule engine (`engine.js`) alone decides pass/fail. The AI explainer reads the request and rule results and returns text; it has no tools and no write path.

## Zero Trust
| Principle | How LaunchGate applies it |
|---|---|
| Verify explicitly | Every call is authenticated with an HMAC-signed, expiring token (`auth.js`). The role is read from the server's user table on every call, never from the client. When hosted, sign-in fails closed (503) until `LAUNCHGATE_SECRET` and a password are configured. |
| Least privilege | `PERMS` in `core.js` lists which roles may call each operation. Requesters only see their own requests. Lists never include submitted code (it is stored in its own column and never selected for lists). The database rejects the public anon key entirely. |
| Assume breach | Audit is append-only **in the database** (trigger blocks update/delete/truncate), so even a leaked service key cannot rewrite history. Secrets are scrubbed from submitted code before storage. AI output cannot change state. |

**If one component is compromised, what can it reach?**
- *A stolen user token:* that user's role only, for at most 8 hours; every action it takes is audited. Rotating `LAUNCHGATE_SECRET` revokes all tokens.
- *The portal / browser:* nothing beyond the signed-in user's role. The browser holds no request state and no database keys.
- *The AI model:* nothing. It receives text and returns text; status changes only happen in `approve`/`deploy`, which the model cannot call.
- *The Supabase service key:* can read and add data, but cannot alter or delete audit history.

## Checklist
| Item | Answer | Where |
|---|---|---|
| **Identity** | Six demo accounts (requester ×2, security, platform, compliance, viewer). Passwords come from app settings: `DEMO_PASSWORDS` (JSON, one password per account, so the requester's password does not open an approver account) and/or `DEMO_PASSWORD` for accounts not listed. The published local password `launchgate-demo` is accepted only when not hosted. The portal asks for each password; none is shipped in the browser bundle. 5 wrong passwords lock an account for 15 minutes (429, even with the right password). Signed tokens, 8h expiry, constant-time comparison of passwords and signatures (hashed first, so any input length or encoding is safe), same error for unknown user and wrong password. Pilot: Microsoft Entra ID via Static Web Apps auth. | `auth.js`, `web/src/api.js` |
| **Permissions** | Role → operation table. Approvers act only when their role is a required approver. Requester can never approve their own request; approver roles cannot create requests. Restricted (cardholder) data also needs the compliance officer. Only `platform` deploys, only `approved` requests deploy. Code cannot change after the first approval. Every save names the version it read, so two people deciding at once cannot overwrite each other: the second gets 409 and must reload (a rejection can never be silently replaced, and a request deploys once). | `core.js` `PERMS`, `approve`, `deploy`, `ingest`; `model.js` tiers; `db.js` `updateRequest` |
| **Secrets** | No secrets in code. Keys come from `local.settings.json` (gitignored) or host app settings. Hosted deployments must set `LAUNCHGATE_SECRET` (shared by every serverless instance, so tokens work across instances) and `DEMO_PASSWORD` or `DEMO_PASSWORDS`; without them nobody can sign in. Service key is server-side only. Pasted secrets in submitted code are redacted before storage, embedding, prompts or logs, including `"key": "value"` JSON and `KEY=value` .env lines. | `local.settings.json.sample`, `auth.js`, `scrub.js` |
| **Data** | Collected: the request form (project name, data class, region, settings, owner, cost center) and optional infrastructure code. Stored in Supabase Postgres (or memory offline). Code has its own column and is read only when a single request is opened. No cardholder or personal data; synthetic demo data only. | `validate.js`, `db/schema.sql` |
| **Privacy** | Form is whitelisted: unknown fields are rejected, so nothing extra can be stored. Questions to the explainer are not logged. The hosted Foundry path receives request fields but not submitted code. | `validate.js`, `core.js` `ask`, `explain.js` |
| **Encryption** | In transit: HTTPS on Static Web Apps and Supabase. At rest: Supabase encrypts storage. Tokens are signed (integrity), not encrypted, and contain only user id, role and expiry. | hosting |
| **Logging** | Every transition (submitted, evaluated, approved/rejected, all-approvals-complete, deploy, code-submitted, explained, audit-exported) and every refusal (`denied` with op, status and reason; `login-failed`; `login-locked`). Never logged: tokens, passwords, submitted code, question text. Exportable by approver and viewer roles. Unexpected errors are logged server-side (the host's log: Application Insights on Azure, function logs on Vercel, the console locally) so production failures can be diagnosed. | `core.js` `stamp`, `handle`, `respond`, `export` |
| **Failure** | Wrong or tampered token → 401. Wrong role → 403. Other users' requests and unknown operations → 404 (ids cannot be probed). Invalid state, or the request changed since it was loaded → 409. Bad input → 400. Too many wrong passwords → 429. Sign-in not configured on a hosted deployment → 503. Unexpected errors return "internal error" without stack traces; error mapping lives in one place (`respond`), shared by all three adapters. If the model is down, the explainer falls back to a deterministic answer that matches the request's real status (blocked, waiting, approved, rejected or deployed). | `core.js` `respond`, `explain.js` |
| **AI guardrails** | Read-only: no tools, no write path. Submitted code is fenced as untrusted and the model is told never to follow instructions inside it. When code is replaced (even with empty code), its old chunks are removed from the vector store, so the explainer never cites code that is no longer there. Answers are labelled AI-generated with a disclaimer. Cited rule ids are checked against the real rules and unknown ones are flagged and audited. Out-of-scope questions are refused. | `rag/system-prompt.md`, `rag/index.js`, `explain.js` |
| **Ownership** | Rules: governance owner (pilot: Mastercard security owns the catalogue). Approvals: the named human in each role, recorded in the audit. Findings on a request: the requester fixes and resubmits. Platform and AI behaviour: the LaunchGate team. | `rules.json`, audit log |
| **Governance** | Every rule cites public controls (PCI DSS 4.0.1, NIST SP 800-53 R5, CIS, Azure Policy). Rules are versioned in git and not editable from the portal. Same input gives the same result, covered by tests. | `rules.json`, `test/engine.test.js` |
| **Demo safety** | Synthetic scenarios only. The published demo password works only on a laptop or in tests; hosted deployments use their own passwords from app settings. No real credentials anywhere in the repo. | `scenarios/`, `auth.js` |

## Responsible AI
- **Transparency:** the AI is an explainer, labelled as AI-generated. The explainer runs a local open model (Llama 3.2 via Ollama) with retrieval over our rules and the submitted code. The Azure AI Foundry adapter is built but not live in this prototype because the team has no Azure credits.
- **Reliability & safety:** the model can be wrong, so it never decides. Pass/fail is deterministic and shown next to every answer; humans approve.
- **Accountability:** every explanation is audited with which path answered and any citation problems.
- **Fairness:** rules apply identically to every request; no person-level attributes are collected.

## Retention
Prototype: data lives until the demo database is reset. Pilot proposal: requests and vectors retained for the life of the environment plus 90 days; audit retained per Mastercard's records policy (e.g. 7 years for SOX evidence).

## Known prototype limits (stated, not hidden)
- Separation of duties is only as real as the passwords: with `DEMO_PASSWORD` alone every account shares one password, so give each account its own with `DEMO_PASSWORDS` and hand them to different people. A pilot uses Entra ID with MFA and Conditional Access.
- The sign-in lockout is counted per server instance, so on serverless it slows password guessing rather than stopping it.
- "Hosted" is detected from the platform's own variables (`VERCEL` on Vercel, `WEBSITE_INSTANCE_ID` on Azure). On any other host, set `LAUNCHGATE_SECRET` and a password yourself; there the published default is still accepted.
- No rate limiting on the explainer.
- Secret scrubbing is pattern-based and catches common formats, not every possible secret.
- Prompt-injection defences reduce risk but cannot eliminate it; this is acceptable because the model cannot act.
- In-memory mode (no Supabase configured) loses data on restart.

## Verified by tests
`npm test --prefix api` runs `test/security.test.js`: no token, bad password, tampered token, non-ASCII password and signature (401, not 500), `toString`/`__proto__` as op or username, hosted deployments without a secret or password (503), per-account passwords, lockout after 5 failures, injected fields, wrong types, oversize code, role limits, cross-user scoping, deploy-before-approval, double approval, code change after approval, blocked-cannot-be-approved, stale writes and concurrent approve/reject and double deploy (409), unexpected errors logged and returned as a bare 500, status-correct fallback answers, secret scrubbing (including JSON keys and .env lines), complete audit, no secrets in the exported audit. `test/engine.test.js` checks that restricted data requires the compliance officer; `test/rag.test.js` checks that replaced or emptied code leaves no old chunks and that concurrent indexing creates no duplicates.
