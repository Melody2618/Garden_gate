import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import Home from './Home.jsx';

const ROLES = {
  owner: { user: 'maria.bd', api: 'requester', title: 'Business owner', blurb: 'I need an environment for a partner project and I want to know how long it takes and who must say yes.', cta: 'Request in plain language' },
  engineer: { user: 'demo.engineer', api: 'requester', title: 'Engineer', blurb: 'I fill in the technical details and want to know immediately which rule I failed and how to fix it.', cta: 'Technical request' },
  security: { user: 'sec.reviewer', api: 'security', title: 'Security reviewer', blurb: 'I only want to see requests that passed the automated checks, with the evidence pack ready.', cta: 'Review evidence' },
  platform: { user: 'platform.lead', api: 'platform', title: 'Platform approver', blurb: 'I sign the deployment and want the audit trail written for me.', cta: 'Approve and deploy' },
  compliance: { user: 'compliance.officer', api: 'compliance', title: 'Compliance officer', blurb: 'For cardholder-data workloads I need to confirm PCI DSS and NYDFS coverage before anything moves.', cta: 'Confirm coverage' },
  exec: { user: 'exec.viewer', api: 'viewer', title: 'Executive view', blurb: 'Show me the handoffs we removed, the time we saved, and where this fits in Mastercard\'s systems.', cta: 'See the impact' },
};
const STACK = ['Azure AI Foundry Agent Service', 'Azure OpenAI', 'Azure Functions', 'Azure Static Web Apps', 'Azure Cosmos DB', 'Microsoft Entra ID', 'Azure Policy', 'Microsoft Defender for Cloud', 'Microsoft Fabric'];
const GH = ['GitHub Copilot', 'GitHub Actions', 'GitHub Advanced Security'];
const BLANK = { template: 'azure-dev-environment', program: 'card-program', partnerName: '', contractRef: '', intentAuditTrail: true, projectName: '', dataClass: 'internal', region: 'eastus2', encryptionAtRest: true, tlsOnly: true, publicEndpoint: false, loggingEnabled: true, owner: '', costCenter: '', authMethod: 'managed-identity' };

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

  const refresh = async (id) => { if (!R) return; setList(await c.list()); setMetrics(await c.metrics()); if (id) { setSel(await c.get(id)); setAudit(await c.audit(id)); } };
  useEffect(() => { refresh().catch(() => {}); }, []);
  useEffect(() => { refresh(sel?.id).catch((e) => [401, 429, 503].includes(e.status) && setErr(e.message)); }, [role]); // show sign-in problems only
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
      <h2>Tell us about the program in plain language</h2>
      <p className="lead">Answer a few questions. LaunchGate fills in the secure defaults, checks the rules, and tells you who has to approve and how long it should take.</p>
      <div className="scen">Try an example: <button onClick={() => loadScenario('approved')}>fintech card program</button><button onClick={() => loadScenario('agentpay')}>Agent Pay airline integration</button><button onClick={() => loadScenario('compliant')}>internal service</button><button onClick={() => loadScenario('blocked')}>misconfigured program</button></div>
      <div className="grid">
        <label>What kind of program?<select value={form.program} onChange={(e) => set('program', e.target.value)}><option value="card-program">Partner card program (fintech, co-brand)</option><option value="agent-pay">Agent Pay integration (agentic commerce)</option><option value="internal-service">Internal service</option></select></label>
        <label>What are you building?<input placeholder="e.g. northbridge-card-launch" value={form.projectName} onChange={(e) => set('projectName', e.target.value)} /></label>
        {form.program !== 'internal-service' && <label>Which partner?<input placeholder="partner name" value={form.partnerName} onChange={(e) => set('partnerName', e.target.value)} /></label>}
        {form.program !== 'internal-service' && <label>Contract or due-diligence reference<input placeholder="e.g. MSA-2026-0388" value={form.contractRef} onChange={(e) => set('contractRef', e.target.value)} /></label>}
        {form.program === 'agent-pay' && <label className="chk"><input type="checkbox" checked={form.intentAuditTrail} onChange={(e) => set('intentAuditTrail', e.target.checked)} /> Verifiable Intent audit trail enabled for agent transactions</label>}
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
      <div className="scen">Load scenario: <button onClick={() => loadScenario('agentpay')}>agent pay</button><button onClick={() => loadScenario('compliant')}>compliant</button><button onClick={() => loadScenario('blocked')}>blocked</button><button onClick={() => loadScenario('approved')}>needs security approval</button></div>
      <div className="grid">
        <label>Program<select value={form.program} onChange={(e) => set('program', e.target.value)}><option>card-program</option><option>agent-pay</option><option>internal-service</option></select></label>
        <label>Project name<input value={form.projectName} onChange={(e) => set('projectName', e.target.value)} /></label>
        <label>Partner<input value={form.partnerName} onChange={(e) => set('partnerName', e.target.value)} /></label>
        <label>Contract ref<input value={form.contractRef} onChange={(e) => set('contractRef', e.target.value)} /></label>
        <label>Data classification<select value={form.dataClass} onChange={(e) => set('dataClass', e.target.value)}><option>internal</option><option>confidential</option><option>restricted</option></select></label>
        <label>Region<select value={form.region} onChange={(e) => set('region', e.target.value)}><option>eastus</option><option>eastus2</option><option>centralus</option><option>westeurope</option></select></label>
        <label>Auth method<select value={form.authMethod} onChange={(e) => set('authMethod', e.target.value)}><option>managed-identity</option><option>connection-string</option></select></label>
        <label>Business owner<input value={form.owner} onChange={(e) => set('owner', e.target.value)} /></label>
        <label>Cost center<input value={form.costCenter} onChange={(e) => set('costCenter', e.target.value)} /></label>
        {[['encryptionAtRest', 'Encrypt data at rest'], ['tlsOnly', 'TLS only (no plain HTTP)'], ['publicEndpoint', 'Public internet endpoint'], ['loggingEnabled', 'Diagnostic logging'], ['intentAuditTrail', 'Verifiable Intent audit trail (Agent Pay)']].map(([k, l]) => <label key={k} className="chk"><input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} /> {l}</label>)}
      </div>
      <button className="primary" onClick={submit}>Submit request</button>
    </section>
  );

  const FIXES = { 'GG-001': { encryptionAtRest: true }, 'GG-002': { tlsOnly: true }, 'GG-003': { region: 'eastus2' }, 'GG-004': { publicEndpoint: false }, 'GG-005': { loggingEnabled: true }, 'GG-007': { authMethod: 'managed-identity' }, 'GG-009': { intentAuditTrail: true } };
  const [tab, setTab] = useState('fix');
  const Outcome = ({ q }) => {
    const m = q.evaluation.model;
    const failed = q.evaluation.results.filter((r) => r.status === 'fail');
    const steps = [['Submitted', true], ['Rules checked', true], ['Approvals', q.status === 'approved' || q.status === 'deployed'], ['Deployed', q.status === 'deployed']];
    const waiting = q.evaluation.requiredApprovers.filter((a) => !q.approvals[a]);
    const next = q.status === 'blocked' ? `Fix ${failed.length} rule${failed.length > 1 ? 's' : ''} and resubmit` : q.status === 'awaiting-approval' ? `Waiting on ${waiting.join(' and ')}` : q.status === 'approved' ? 'Ready to deploy' : q.status === 'deployed' ? 'Done' : 'Sent back, needs changes';
    const canFix = role === 'owner' || role === 'engineer';
    const applyFixes = () => { const patch = {}; failed.forEach((f) => Object.assign(patch, FIXES[f.id] || {})); const { id, createdAt, requester, approvals, audit, evaluation, status, deployment, version, hasCode, ...rest } = q; const fixed = { ...rest, ...patch }; if (failed.some((f) => f.id === 'GG-006')) { fixed.owner = fixed.owner || 'maria.bd'; fixed.costCenter = fixed.costCenter || 'CC-4410'; } if (failed.some((f) => f.id === 'GG-010')) { fixed.partnerName = fixed.partnerName || 'Northbridge Fintech'; fixed.contractRef = fixed.contractRef || 'MSA-2026-0388'; } setForm(fixed); run(async () => { const r = await c.create(fixed); setAnswer(null); setTab('fix'); await refresh(r.id); }); };
    const tabs = [['fix', q.status === 'blocked' ? `What to fix (${failed.length})` : 'Summary'], ['rules', `Rules (${q.evaluation.results.length})`], ['handoffs', `Handoffs (${m.handoffs.length})`], ['audit', `Audit (${(q.audit || audit).length})`]];
    return (
      <section className="req">
        <div className="reqhead">
          <div><h2>{q.projectName} <span className="muted">{q.id} · {q.program}{q.partnerName ? ' · ' + q.partnerName : ''}</span></h2><div className="next"><Pill v={q.status} /> <b>Next:</b> {next}</div></div>
          <div className="stepper">{steps.map(([n, done], i) => <div key={n} className={'step ' + (done ? 'done' : '')}><i>{done ? '✓' : i + 1}</i><span>{n}</span></div>)}</div>
        </div>
        <div className="compare slim">
          <div className="today"><h4>Today at Mastercard</h4><big>12 handoffs</big><small>6 to 8 months (reported)</small></div>
          <div className="after"><h4>With LaunchGate</h4><big>1 request + {m.summary.human} human {m.summary.human === 1 ? 'approval' : 'approvals'}</big><small>{m.summary.automated} automated, {m.summary.merged} merged. Risk {m.riskScore}/100, {m.tierLabel.toLowerCase()}. Typical turnaround {m.todaySla}.</small></div>
        </div>
        <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

        {tab === 'fix' && <div>
          {q.status === 'blocked' && <>
            <div className="row between"><p className="err slim">Blocked by {failed.length} rule{failed.length > 1 ? 's' : ''}. Nobody was emailed. Fix and resubmit.</p>{canFix && <button className="primary" onClick={applyFixes}>Apply all fixes and resubmit</button>}</div>
            <div className="fixes">{failed.map((f) => <div className="fixcard" key={f.id}><div><b>{f.id} · {f.name}</b><span>{f.fix}</span><small>{f.controls.join(' · ')}</small></div>{canFix && FIXES[f.id] && <button onClick={() => { setForm({ ...form, ...FIXES[f.id] }); }}>Fix in form</button>}</div>)}</div>
          </>}
          {q.status !== 'blocked' && <div className="okbox"><b>All {q.evaluation.results.filter((r) => r.status !== 'skipped').length} checks passed.</b> Must approve: {q.evaluation.requiredApprovers.map((a) => <span key={a} className={'pill ' + (q.approvals[a]?.decision === 'approve' ? 'approved' : 'awaiting-approval')}>{a}: {q.approvals[a]?.decision || 'waiting'}</span>)}</div>}
          <p className="promise">{m.promise}</p>
          <div className="row">
            {q.status === 'awaiting-approval' && R.api !== 'requester' && R.api !== 'viewer' && q.evaluation.requiredApprovers.includes(R.api) && !q.approvals[R.api] && <>
              <button className="primary" onClick={() => run(async () => { await c.approve(q.id, 'approve', 'reviewed evidence pack'); await refresh(q.id); })}>Approve as {R.title}</button>
              <button onClick={() => run(async () => { await c.approve(q.id, 'reject', 'needs changes'); await refresh(q.id); })}>Send back</button></>}
            {q.status === 'approved' && R.api === 'platform' && <button className="primary" onClick={() => run(async () => { await c.deploy(q.id); await refresh(q.id); })}>Deploy to Azure (simulated)</button>}
            {q.deployment && <span className="ok">Deployed (simulated) to {q.deployment.resourceGroup} in {q.deployment.region} from the Copilot-drafted Bicep template.</span>}
            {canFix && <button onClick={() => { const { id, createdAt, requester, approvals, audit, evaluation, status, deployment, version, hasCode, ...rest } = q; setForm({ ...rest, projectName: rest.projectName + '-2' }); window.scrollTo(0, 0); }}>Clone for a new partner</button>}
          </div>
          <h3>Ask the Azure AI Foundry agent (read-only)</h3>
          <div className="row"><input className="wide" value={question} onChange={(e) => setQuestion(e.target.value)} /><button onClick={() => run(async () => setAnswer(await c.explain(q.id, question)))}>Ask</button></div>
          {answer && <div className="answer"><b>{answer.source}</b><p>{answer.answer}</p></div>}
          <div className="stack small">{m.compliance.map((f) => <span key={f.id} title={f.why}>{f.id}</span>)}</div>
        </div>}

        {tab === 'rules' && <table><thead><tr><th>Rule</th><th>Result</th><th>Controls cited</th><th>Fix</th></tr></thead><tbody>
          {q.evaluation.results.map((r) => <tr key={r.id}><td>{r.id} {r.name}</td><td><Pill v={r.status} /></td><td>{r.controls.join('; ')}</td><td>{r.fix || ''}</td></tr>)}
        </tbody></table>}

        {tab === 'handoffs' && <table><thead><tr><th>#</th><th>Handoff today</th><th>With LaunchGate</th><th></th></tr></thead><tbody>
          {m.handoffs.map((h) => <tr key={h.n}><td>{h.n}</td><td><b>{h.name}</b><br /><span className="muted">{h.today}</span></td><td>{h.with}</td><td><Pill v={h.mode} /></td></tr>)}
        </tbody></table>}

        {tab === 'audit' && <ul className="audit">{(q.audit || audit).map((e, i) => <li key={i}><code>{e.ts}</code> <b>{e.actor}</b> {e.action} <span>{JSON.stringify(e.detail)}</span></li>)}</ul>}
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
          {rows.map((q) => <tr key={q.id} className={'click ' + (sel?.id === q.id ? 'on' : '')} onClick={() => refresh(q.id)}><td>{q.id}</td><td>{q.projectName}<br /><span className="muted">{q.program}{q.partnerName ? ' · ' + q.partnerName : ''}</span></td><td>{q.dataClass}</td><td><Pill v={q.evaluation.model.tier} /></td><td><Pill v={q.status} /></td><td>{q.evaluation.requiredApprovers.map((a) => `${a}: ${q.approvals[a]?.decision || 'waiting'}`).join(' · ')}</td></tr>)}
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
      {role === 'compliance' && <Inbox title="Compliance inbox" lead="Cardholder-data (high-risk) requests that need a compliance confirmation of PCI DSS and NYDFS coverage." filter={(q) => q.evaluation.requiredApprovers.includes('compliance') && q.status !== 'blocked'} />}
      {role === 'platform' && <Inbox title="Platform inbox" lead="Approve the deployment, then deploy. The audit trail is written for you." filter={(q) => q.status !== 'blocked'} />}
      {(role === 'owner' || role === 'engineer') && list.length > 0 && <Inbox title="Your requests" lead="Click one to see where it stands." filter={() => true} />}
      {role === 'exec' && <Exec />}
      {role && role !== 'exec' && sel && <Outcome q={sel} />}
    </div>
  );
}
