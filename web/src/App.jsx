import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import Home from './Home.jsx';

const ROLES = {
  owner: { user: 'maria.bd', api: 'requester', title: 'Business owner', blurb: 'I need an environment for a partner project and I want to know how long it takes and who must say yes.', cta: 'Request in plain language' },
  engineer: { user: 'demo.engineer', api: 'requester', title: 'Engineer', blurb: 'I fill in the technical details and want to know immediately which rule I failed and how to fix it.', cta: 'Technical request' },
  security: { user: 'sec.reviewer', api: 'security', title: 'Security reviewer', blurb: 'I only want to see requests that passed the automated checks, with the evidence pack ready.', cta: 'Review evidence' },
  platform: { user: 'platform.lead', api: 'platform', title: 'Platform approver', blurb: 'I sign the deployment and want the audit trail written for me.', cta: 'Approve and deploy' },
  compliance: { user: 'compliance.officer', api: 'compliance', title: 'Compliance officer', blurb: 'For critical workloads I need to confirm PCI DSS and NYDFS coverage before anything moves.', cta: 'Confirm coverage' },
  exec: { user: 'exec.viewer', api: 'viewer', title: 'Executive view', blurb: 'Show me the handoffs we removed, the time we saved, and where this fits in Mastercard\'s systems.', cta: 'See the impact' },
};
const STACK = ['Azure AI Foundry Agent Service', 'Azure OpenAI', 'Azure Functions', 'Azure Static Web Apps', 'Azure Cosmos DB', 'Microsoft Entra ID', 'Azure Policy', 'Microsoft Defender for Cloud', 'Microsoft Fabric'];
const GH = ['GitHub Copilot', 'GitHub Actions', 'GitHub Advanced Security'];
const BLANK = { template: 'azure-dev-environment', projectName: '', dataClass: 'internal', region: 'eastus2', encryptionAtRest: true, tlsOnly: true, publicEndpoint: false, loggingEnabled: true, owner: '', costCenter: '', authMethod: 'managed-identity' };

const Pill = ({ v }) => <span className={'pill ' + v}>{v}</span>;
const Stack = () => <div className="stack">{STACK.map((s) => <span key={s}>{s}</span>)}{GH.map((s) => <span key={s} className="gh">{s}</span>)}</div>;

export default function App() {
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  const go = (p) => { window.history.pushState({}, '', p); setPath(p); window.scrollTo(0, 0); };
  useEffect(() => { const f = () => setPath(window.location.pathname + window.location.search); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f); }, []);
  const initialRole = new URLSearchParams(window.location.search).get('role');
  const [role, setRole] = useState(initialRole && ROLES[initialRole] ? initialRole : null);
  const [form, setForm] = useState(BLANK);
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [audit, setAudit] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [question, setQuestion] = useState('Why is this request blocked and what should change?');
  const [answer, setAnswer] = useState(null);
  const [err, setErr] = useState('');
  const R = role ? ROLES[role] : null;
  const c = api(R?.user || 'anon', R?.api || 'viewer');

  const refresh = async (id) => { setList(await c.list()); setMetrics(await c.metrics()); if (id) { setSel(await c.get(id)); setAudit(await c.audit(id)); } };
  useEffect(() => { refresh().catch(() => {}); }, []);
  useEffect(() => { refresh(sel?.id).catch(() => {}); }, [role]);
  const run = (fn) => fn().then(() => setErr('')).catch((e) => setErr(e.message));
  const set = (k, v) => setForm({ ...form, [k]: v });
  const loadScenario = async (name) => setForm(await fetch(`/scenarios/${name}.json`).then((r) => r.json()));
  const submit = () => run(async () => { const r = await c.create(form); setAnswer(null); await refresh(r.id); });

  const Landing = () => (
    <>
      <section>
        <h2>Pick how you work</h2>
        <p className="lead">Each role sees the same request from its own side: plain questions for a business owner, rule results for an engineer, an evidence pack for reviewers, impact for an executive.</p>
        <div className="cards">{Object.entries(ROLES).map(([k, r]) => <div className="card" key={k} onClick={() => setRole(k)}><b>{r.title}</b><span>{r.blurb}</span><em>{r.cta} →</em></div>)}</div>
      </section>
      <section><h3>Built on Microsoft Azure and GitHub</h3><Stack /></section>
    </>
  );

  const OwnerForm = () => (
    <section>
      <h2>Tell us about the project in plain language</h2>
      <p className="lead">Answer five questions. LaunchGate fills in the secure defaults, checks the rules, and tells you who has to approve and how long it should take.</p>
      <div className="scen">Try an example: <button onClick={() => loadScenario('compliant')}>partner loyalty API</button><button onClick={() => loadScenario('approved')}>merchant onboarding (customer data)</button><button onClick={() => loadScenario('blocked')}>cardholder insights (misconfigured)</button></div>
      <div className="grid">
        <label>What are you building?<input placeholder="e.g. partner-loyalty-api" value={form.projectName} onChange={(e) => set('projectName', e.target.value)} /></label>
        <label>Does it touch customer or card data?<select value={form.dataClass} onChange={(e) => set('dataClass', e.target.value)}><option value="internal">No, internal data only</option><option value="confidential">Customer data (confidential)</option><option value="restricted">Cardholder data (restricted)</option></select></label>
        <label>Who is accountable for it?<input placeholder="business owner" value={form.owner} onChange={(e) => set('owner', e.target.value)} /></label>
        <label>Which budget pays for it?<input placeholder="cost center, e.g. CC-4410" value={form.costCenter} onChange={(e) => set('costCenter', e.target.value)} /></label>
        <label>Where should it run?<select value={form.region} onChange={(e) => set('region', e.target.value)}><option value="eastus2">United States (East 2)</option><option value="eastus">United States (East)</option><option value="centralus">United States (Central)</option><option value="westeurope">Europe (West)</option></select></label>
        <label className="chk"><input type="checkbox" checked={form.publicEndpoint} onChange={(e) => set('publicEndpoint', e.target.checked)} /> Reachable from the public internet</label>
      </div>
      <p className="muted">Secure defaults applied for you: encryption at rest, TLS only, diagnostic logging, managed identity (no stored passwords).</p>
      <button className="primary" onClick={submit}>Check my request</button>
    </section>
  );

  const EngineerForm = () => (
    <section>
      <h2>Technical request</h2>
      <div className="scen">Load scenario: <button onClick={() => loadScenario('compliant')}>compliant</button><button onClick={() => loadScenario('blocked')}>blocked</button><button onClick={() => loadScenario('approved')}>needs security approval</button></div>
      <div className="grid">
        <label>Project name<input value={form.projectName} onChange={(e) => set('projectName', e.target.value)} /></label>
        <label>Data classification<select value={form.dataClass} onChange={(e) => set('dataClass', e.target.value)}><option>internal</option><option>confidential</option><option>restricted</option></select></label>
        <label>Region<select value={form.region} onChange={(e) => set('region', e.target.value)}><option>eastus</option><option>eastus2</option><option>centralus</option><option>westeurope</option></select></label>
        <label>Auth method<select value={form.authMethod} onChange={(e) => set('authMethod', e.target.value)}><option>managed-identity</option><option>connection-string</option></select></label>
        <label>Business owner<input value={form.owner} onChange={(e) => set('owner', e.target.value)} /></label>
        <label>Cost center<input value={form.costCenter} onChange={(e) => set('costCenter', e.target.value)} /></label>
        {['encryptionAtRest', 'tlsOnly', 'publicEndpoint', 'loggingEnabled'].map((k) => <label key={k} className="chk"><input type="checkbox" checked={form[k]} onChange={(e) => set(k, e.target.checked)} /> {k}</label>)}
      </div>
      <button className="primary" onClick={submit}>Submit request</button>
    </section>
  );

  const Outcome = ({ q }) => {
    const m = q.evaluation.model;
    return (
      <section>
        <h2>{q.id} · {q.projectName} <Pill v={q.status} /></h2>
        <div className="compare">
          <div className="today"><h4>Today at Mastercard</h4><big>12 handoffs</big><small>6–8 months to a usable environment (as reported in Discovery)</small></div>
          <div className="after"><h4>With LaunchGate</h4><big>1 request + {m.summary.human} human {m.summary.human === 1 ? 'approval' : 'approvals'}</big><small>{m.summary.automated} steps automated, {m.summary.merged} merged into the request. Risk tier: {m.tierLabel.toLowerCase()}, typical turnaround {m.todaySla}.</small></div>
        </div>
        <h3>Readiness model (deterministic, auditable)</h3>
        <div className="score"><b>Risk {m.riskScore}/100</b><div className="gauge"><i style={{ width: m.riskScore + '%' }} /></div><Pill v={m.tier} /></div>
        <p className="muted">{m.factors.filter((f) => f.points > 0).map((f) => `${f.factor} +${f.points} (${f.because})`).join(' · ') || 'No risk factors raised.'} Must approve: <b>{q.evaluation.requiredApprovers.join(', ')}</b>.</p>
        {q.status === 'blocked' && <p className="err">Blocked by policy: {q.evaluation.failed.join(', ')}. Fix these and resubmit; nobody has to be emailed.</p>}
        {role === 'owner' ? (
          <><h3>What has to be true before it is approved</h3><ul className="audit">{q.evaluation.results.filter((r) => r.status !== 'skipped').map((r) => <li key={r.id}><Pill v={r.status} /> {r.name}{r.fix ? ` · ${r.fix}` : ''}</li>)}</ul></>
        ) : (
          <><h3>Rule results with the controls they cite</h3>
          <table><thead><tr><th>Rule</th><th>Result</th><th>Controls cited</th><th>Fix</th></tr></thead><tbody>
            {q.evaluation.results.map((r) => <tr key={r.id}><td>{r.id} {r.name}</td><td><Pill v={r.status} /></td><td>{r.controls.join('; ')}</td><td>{r.fix || ''}</td></tr>)}
          </tbody></table></>
        )}
        <h3>Compliance this request is held to</h3>
        <div className="stack">{m.compliance.map((f) => <span key={f.id} title={f.why}>{f.id}</span>)}</div>
        <div className="row">
          {q.status === 'awaiting-approval' && R.api !== 'requester' && R.api !== 'viewer' && q.evaluation.requiredApprovers.includes(R.api) && !q.approvals[R.api] && <>
            <button className="primary" onClick={() => run(async () => { await c.approve(q.id, 'approve', 'reviewed evidence pack'); await refresh(q.id); })}>Approve as {R.title}</button>
            <button onClick={() => run(async () => { await c.approve(q.id, 'reject', 'needs changes'); await refresh(q.id); })}>Send back</button></>}
          {q.status === 'approved' && R.api === 'platform' && <button className="primary" onClick={() => run(async () => { await c.deploy(q.id); await refresh(q.id); })}>Deploy to Azure (simulated)</button>}
          {q.deployment && <span className="ok">Deployed (simulated) to {q.deployment.resourceGroup} in {q.deployment.region} from the Copilot-drafted Bicep template.</span>}
        </div>
        <h3>Ask the Azure AI Foundry agent (read-only, it never approves)</h3>
        <div className="row"><input className="wide" value={question} onChange={(e) => setQuestion(e.target.value)} /><button onClick={() => run(async () => setAnswer(await c.explain(q.id, question)))}>Ask</button></div>
        {answer && <div className="answer"><b>{answer.source}</b><p>{answer.answer}</p></div>}
        <h3>The 12 handoffs, and what happened to each</h3>
        <table><thead><tr><th>#</th><th>Handoff today</th><th>With LaunchGate</th><th></th></tr></thead><tbody>
          {m.handoffs.map((h) => <tr key={h.n}><td>{h.n}</td><td><b>{h.name}</b><br /><span className="muted">{h.today}</span></td><td>{h.with}</td><td><Pill v={h.mode} /></td></tr>)}
        </tbody></table>
        <h3>Audit log</h3>
        <ul className="audit">{audit.map((e, i) => <li key={i}><code>{e.ts}</code> <b>{e.actor}</b> {e.action} <span>{JSON.stringify(e.detail)}</span></li>)}</ul>
      </section>
    );
  };

  const Inbox = ({ filter, title, lead }) => {
    const rows = list.filter(filter);
    return (
      <section>
        <h2>{title}</h2><p className="lead">{lead}</p>
        {rows.length === 0 ? <p className="muted">Nothing waiting. Submit a request as a business owner or engineer first.</p> :
        <table><thead><tr><th>ID</th><th>Project</th><th>Data</th><th>Risk</th><th>Status</th><th>Approvals</th></tr></thead><tbody>
          {rows.map((q) => <tr key={q.id} className={'click ' + (sel?.id === q.id ? 'on' : '')} onClick={() => refresh(q.id)}><td>{q.id}</td><td>{q.projectName}</td><td>{q.dataClass}</td><td><Pill v={q.evaluation.model.tier} /></td><td><Pill v={q.status} /></td><td>{q.evaluation.requiredApprovers.map((a) => `${a}: ${q.approvals[a]?.decision || 'waiting'}`).join(' · ')}</td></tr>)}
        </tbody></table>}
      </section>
    );
  };

  const Exec = () => (
    <>
      {metrics && <section><h2>Impact so far in this demo</h2>
        <div className="tiles"><div className="hot"><b>12</b>handoffs today (reported by Mastercard)</div><div className="good"><b>1</b>request in LaunchGate</div><div><b>{metrics.requests}</b>requests</div><div><b>{metrics.blocked}</b>stopped by policy before anyone was emailed</div><div><b>{metrics.deployed}</b>deployed with full audit</div><div className="good"><b>{metrics.avgMinutesRequestToDeploy == null ? '–' : metrics.avgMinutesRequestToDeploy.toFixed(1)}</b>minutes request to deploy</div></div>
      </section>}
      <section><h2>How the handoffs disappear</h2><p className="lead">Eight of the twelve steps become automated checks, three are merged into the single request, and one or two stay human, depending on the risk tier the model assigns. The approval is never automated.</p>
        <div className="compare"><div className="today"><h4>Today</h4><big>12 people, in sequence</big><small>Each one re-checks policy by hand. If someone leaves, the process restarts.</small></div><div className="after"><h4>With LaunchGate</h4><big>Rules as code + 1–2 approvers</big><small>Same input gives the same result every time, with PCI DSS and NIST citations attached.</small></div></div>
      </section>
      <section><h2>Where it fits in Mastercard's systems</h2><p className="lead">From public sources: Mastercard runs a global on-prem OpenShift estate plus AWS and Azure for internal applications, uses Jenkins, Ansible and Terraform, and already hires for policy-as-code (OPA, Conftest, Sentinel) and PCI DSS gates in CI. LaunchGate sits in front of that pipeline rather than replacing it.</p>
        <div className="fit">
          <div><b>Identity</b><span>Microsoft Entra ID issues the requester and approver roles; Conditional Access applies.</span></div>
          <div><b>Rules</b><span>Azure Policy schema today; exportable to OPA/Conftest so the same rules run in Jenkins and in Azure.</span></div>
          <div><b>Evidence</b><span>Azure AI Foundry agent drafts the risk memo and explains results; Defender for Cloud scores the deployed environment against PCI DSS 4 and NIST 800-53.</span></div>
          <div><b>Provisioning</b><span>Approved Bicep (or Terraform) goes to GitHub Actions behind an environment protection rule; Azure Deployment Environments in pilot.</span></div>
          <div><b>Record</b><span>Append-only audit in Cosmos DB; Fabric dashboard reports cycle time per request for SOX and PCI evidence.</span></div>
          <div><b>Data</b><span>Purview sensitivity labels select the rule pack; no cardholder data ever enters LaunchGate itself.</span></div>
        </div>
      </section>
      <section><h2>Compliance we target</h2>
        <table><thead><tr><th>Framework</th><th>Why it applies to Mastercard</th></tr></thead><tbody>
          {(list[0]?.evaluation.model.compliance || []).concat([]).map((f) => <tr key={f.id}><td><b>{f.id}</b></td><td>{f.why}</td></tr>)}
          {!list.length && <tr><td colSpan="2" className="muted">Submit a request to see the applicable frameworks (PCI DSS 4.0.1, NYDFS 23 NYCRR 500, SOX ITGC, NIST SP 800-53 R5, GLBA Safeguards).</td></tr>}
        </tbody></table>
      </section>
      <section><h3>Built on Microsoft Azure and GitHub</h3><Stack /></section>
    </>
  );

  if (!path.startsWith('/demo')) return <Home go={(p) => { go(p); const r = new URLSearchParams(p.split('?')[1] || '').get('role'); setRole(r && ROLES[r] ? r : null); }} />;
  return (
    <div className="app">
      <header>
        <div className="logo" onClick={() => { setRole(null); setSel(null); go('/'); }}><div className="mark"><i /><i /></div><h1>LaunchGate</h1></div>
        <span className="sub">Team Garden State for Mastercard · built on Microsoft Azure</span>
        {role && <div className="rolebar">{Object.entries(ROLES).map(([k, r]) => <button key={k} className={role === k ? 'on' : ''} onClick={() => setRole(k)}>{r.title}</button>)}</div>}
      </header>
      {err && <div className="err">{err}</div>}
      {!role && <Landing />}
      {role === 'owner' && <OwnerForm />}
      {role === 'engineer' && <EngineerForm />}
      {role === 'security' && <Inbox title="Security inbox" lead="Only requests that passed the automated checks and need a security decision. The evidence pack is attached; the agent's memo is one click away." filter={(q) => q.evaluation.requiredApprovers.includes('security') && q.status !== 'blocked'} />}
      {role === 'compliance' && <Inbox title="Compliance inbox" lead="Critical-tier requests that need a compliance confirmation of PCI DSS and NYDFS coverage." filter={(q) => q.evaluation.requiredApprovers.includes('compliance') && q.status !== 'blocked'} />}
      {role === 'platform' && <Inbox title="Platform inbox" lead="Approve the deployment, then deploy. The audit trail is written for you." filter={(q) => q.status !== 'blocked'} />}
      {(role === 'owner' || role === 'engineer') && list.length > 0 && <Inbox title="Your requests" lead="Click one to see where it stands." filter={() => true} />}
      {role === 'exec' && <Exec />}
      {role && role !== 'exec' && sel && <Outcome q={sel} />}
    </div>
  );
}
