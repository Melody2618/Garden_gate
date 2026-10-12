import React, { useEffect, useState } from 'react';
import { api } from './api.js';

const USERS = { requester: 'demo.engineer', security: 'sec.reviewer', platform: 'platform.lead' };
const BLANK = { template: 'azure-dev-environment', projectName: '', dataClass: 'internal', region: 'eastus2', encryptionAtRest: true, tlsOnly: true, publicEndpoint: false, loggingEnabled: true, owner: '', costCenter: '', authMethod: 'managed-identity' };

export default function App() {
  const [role, setRole] = useState('requester');
  const [form, setForm] = useState(BLANK);
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [audit, setAudit] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [question, setQuestion] = useState('Why is my request blocked and what should I change?');
  const [answer, setAnswer] = useState(null);
  const [err, setErr] = useState('');
  const c = api(USERS[role], role);

  const refresh = async (id) => { setList(await c.list()); setMetrics(await c.metrics()); if (id) { setSel(await c.get(id)); setAudit(await c.audit(id)); } };
  useEffect(() => { refresh(sel?.id).catch(() => {}); }, [role]);
  const run = (fn) => fn().then(() => setErr('')).catch((e) => setErr(e.message));
  const set = (k, v) => setForm({ ...form, [k]: v });
  const loadScenario = async (name) => { const s = await fetch(`/scenarios/${name}.json`).then((r) => r.json()); setForm(s); };

  return (
    <div className="app">
      <header><h1>LaunchGate</h1><span className="sub">Policy-aware deployment control plane · Team Garden State for Mastercard</span>
        <label>Signed in as (Entra ID role) <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="requester">Engineer (requester)</option><option value="security">Security approver</option><option value="platform">Platform approver</option></select></label>
      </header>
      {err && <div className="err">{err}</div>}
      <main>
        <section>
          <h2>1 · Request an environment</h2>
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
          <button className="primary" disabled={role !== 'requester'} onClick={() => run(async () => { const r = await c.create(form); await refresh(r.id); })}>Submit request</button>
        </section>

        <section>
          <h2>2 · Requests</h2>
          <table><thead><tr><th>ID</th><th>Project</th><th>Status</th><th>Approvals</th></tr></thead><tbody>
            {list.map((q) => <tr key={q.id} className={sel?.id === q.id ? 'on' : ''} onClick={() => refresh(q.id)}><td>{q.id}</td><td>{q.projectName}</td><td><span className={'pill ' + q.status}>{q.status}</span></td><td>{q.evaluation.requiredApprovers.map((a) => `${a}:${q.approvals[a]?.decision || '…'}`).join(' ')}</td></tr>)}
          </tbody></table>
        </section>

        {sel && <section>
          <h2>3 · {sel.id} · rule results</h2>
          <table><thead><tr><th>Rule</th><th>Result</th><th>Controls cited</th><th>Fix</th></tr></thead><tbody>
            {sel.evaluation.results.map((r) => <tr key={r.id}><td>{r.id} {r.name}</td><td><span className={'pill ' + r.status}>{r.status}</span></td><td>{r.controls.join('; ')}</td><td>{r.fix || ''}</td></tr>)}
          </tbody></table>
          <div className="row">
            {sel.status === 'awaiting-approval' && role !== 'requester' && <>
              <button className="primary" onClick={() => run(async () => { await c.approve(sel.id, 'approve', 'reviewed evidence pack'); await refresh(sel.id); })}>Approve as {role}</button>
              <button onClick={() => run(async () => { await c.approve(sel.id, 'reject', 'needs changes'); await refresh(sel.id); })}>Reject</button></>}
            {sel.status === 'approved' && <button className="primary" onClick={() => run(async () => { await c.deploy(sel.id); await refresh(sel.id); })}>Deploy (simulated Azure)</button>}
            {sel.deployment && <span className="ok">Deployed (simulated) to {sel.deployment.resourceGroup} in {sel.deployment.region}; Bicep template {sel.deployment.templateLines} lines.</span>}
          </div>
          <h3>Ask the Foundry agent (read-only)</h3>
          <div className="row"><input className="wide" value={question} onChange={(e) => setQuestion(e.target.value)} /><button onClick={() => run(async () => setAnswer(await c.explain(sel.id, question)))}>Ask</button></div>
          {answer && <div className="answer"><b>{answer.source}</b><p>{answer.answer}</p></div>}
          <h3>Audit log</h3>
          <ul className="audit">{audit.map((e, i) => <li key={i}><code>{e.ts}</code> <b>{e.actor}</b> {e.action} <span>{JSON.stringify(e.detail)}</span></li>)}</ul>
        </section>}

        {metrics && <section className="metrics">
          <h2>4 · Readiness metrics</h2>
          <div className="tiles"><div><b>{metrics.baselineHandoffs}</b>handoffs today (reported)</div><div><b>{metrics.handoffsPerRequest}</b>request in LaunchGate</div><div><b>{metrics.requests}</b>requests</div><div><b>{metrics.blocked}</b>blocked by policy</div><div><b>{metrics.deployed}</b>deployed</div><div><b>{metrics.avgMinutesRequestToDeploy == null ? '–' : metrics.avgMinutesRequestToDeploy.toFixed(1)}</b>min request → deploy</div></div>
        </section>}
      </main>
    </div>
  );
}
