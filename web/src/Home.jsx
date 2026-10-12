import React from 'react';

const BANNER = 'LEAD ASPIRE 2026 Final · Microsoft Times Square, New York · Team Garden State · Customer: Mastercard · Consulting partner: EY';
const STACK = ['Azure AI Foundry Agent Service', 'Azure OpenAI', 'Azure Functions', 'Azure Static Web Apps', 'Azure Cosmos DB', 'Microsoft Entra ID', 'Azure Policy', 'Microsoft Defender for Cloud', 'Microsoft Fabric', 'GitHub Copilot', 'GitHub Actions', 'GitHub Advanced Security'];

export default function Home({ go }) {
  return (
    <div className="home">
      <div className="ticker"><div className="ticker-track">{[0, 1, 2].map((i) => <span key={i}>✦ {BANNER}</span>)}</div></div>
      <nav className="nav"><div className="logo" onClick={() => go('/')}><div className="mark"><i /><i /></div><span>LaunchGate</span></div><button className="pill dark" onClick={() => go('/demo')}>Try the demo <i className="arr">→</i></button></nav>

      <section className="hero2">
        <h1>Twelve handoffs stand between<br />an approved idea and a first commit.</h1>
        <h1 className="dim">What if it took one request?</h1>
        <div className="herocard">
          <div className="fakeinput"><span className="dot" /> How long until my team can start building?</div>
          <button className="pill dark big" onClick={() => go('/demo')}>Open the LaunchGate demo <i className="arr">→</i></button>
          <div className="chips"><span>6 to 8 months today</span><span>12 handoffs</span><span>Target: 1 request + the approvals that must stay human</span></div>
        </div>
      </section>

      <section className="black">
        <div className="tag">● The platform behind governed delivery</div>
        <h2>A deployment control plane,<br />built for a regulated network.</h2>
        <p>Mastercard told us that policy, orchestration and human review are the real delay, not the virtual machine. LaunchGate writes the policy down as code, lets an Azure AI Foundry agent prepare the evidence pack, routes only the approvals that must stay human, and records every decision. Nothing deploys without a person.</p>
        <div className="row"><button className="pill light" onClick={() => go('/demo')}>Explore the demo <i className="arr">→</i></button><button className="ghost" onClick={() => go('/demo?role=exec')}>See the executive view</button></div>
      </section>

      <section className="challenge">
        <div className="tag grey">The challenge</div>
        <h2>Compliance is checked by hand, twelve times in a row.<br />Every new environment restarts the chain.</h2>
        <p>Mastercard told us a development environment takes six to eight months and about twelve handoffs. The pattern is industry-wide: approval chains, not provisioning, are the delay, and regulators have started to say so.</p>
        <div className="statcard">
          <div><b>78%</b><span>of engineering teams wait a day or more for DevOps help; 16% wait a week or more</span></div>
          <div className="sep" />
          <div><b>81</b><span>steps, 3 tickets and a change request to ship one line of code at Morgan Stanley</span></div>
          <div className="sep" />
          <div><b>90%+</b><span>of major changes approved by change boards in the FCA's review of a million changes, which it called a question over their effectiveness</span></div>
          <small>Port, State of Internal Developer Portals 2025 · Team Topologies, Jan 2026 (Morgan Stanley, Gus Paul) · UK FCA, Implementing Technology Change, 2021 · Telos: 58 working days per quarter on compliance audits (2020)</small>
        </div>
        <div className="chips light"><span>Deutsche Bank: 350+ infrastructure policies as code, 3,000+ developers self-serving (HashiCorp)</span><span>Synchrony: pre-approved modules, minutes instead of days (Tensure, 2026)</span><span>Gartner: 80% of large engineering orgs run platform teams by 2026</span></div>
      </section>

      <section className="how">
        <div className="tag grey">How it works</div>
        <h2>Agents prepare. Rules decide. People approve.</h2>
        <div className="three">
          <div><i className="ic ic1" /><b>Ask once</b><span>A business owner or engineer answers a few plain questions. Secure defaults are applied so nobody chases twelve teams.</span></div>
          <div><i className="ic ic2" /><b>Rules decide, instantly</b><span>A deterministic readiness model scores the risk and runs every rule. Each result names the control it cites, from PCI DSS 4.0.1 to NIST 800-53, and the fix.</span></div>
          <div><i className="ic ic3" /><b>Humans stay in charge</b><span>An Azure AI Foundry agent on an open model drafts the evidence pack. Security and platform approve in one place. A GitHub environment gate enforces it.</span></div>
        </div>
      </section>

      <section className="black">
        <div className="tag">Built on Microsoft Azure and GitHub</div>
        <h2>Compliance built in, not bolted on.</h2>
        <p>PCI DSS 4.0.1 · NYDFS 23 NYCRR 500 · SOX ITGC · NIST SP 800-53 R5 · GLBA Safeguards. Every rule is versioned code with a public source, so the same request gives the same answer every time and an auditor can read why.</p>
        <div className="stack dark">{STACK.map((s) => <span key={s}>{s}</span>)}</div>
        <div className="row"><button className="pill light" onClick={() => go('/demo')}>Try the demo <i className="arr">→</i></button></div>
      </section>
      <footer className="foot">Team Garden State · LEAD ASPIRE 2026 · Prototype for Mastercard, built on Microsoft Azure with GitHub Copilot. Demo data is synthetic. Rules are illustrative and cite public standards.</footer>
    </div>
  );
}
