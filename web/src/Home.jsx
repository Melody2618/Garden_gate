import React from 'react';

const BANNER = 'LEAD ASPIRE 2026 Final · Microsoft Times Square, New York · Team Garden State · Customer: Mastercard · Consulting partner: EY';
const STACK = ['Azure AI Foundry Agent Service', 'Azure OpenAI', 'Azure Functions', 'Azure Static Web Apps', 'Azure Cosmos DB', 'Microsoft Entra ID', 'Azure Policy', 'Microsoft Defender for Cloud', 'Microsoft Fabric', 'GitHub Copilot', 'GitHub Actions', 'GitHub Advanced Security'];

export default function Home({ go }) {
  return (
    <div className="home">
      <div className="ticker"><div className="ticker-track">{[0, 1, 2].map((i) => <span key={i}>✦ {BANNER}</span>)}</div></div>
      <nav className="nav"><div className="logo" onClick={() => go('/')}><div className="mark"><i /><i /></div><span>LaunchGate</span></div><button className="pill dark" onClick={() => go('/demo')}>Try the demo <i className="arr">→</i></button></nav>

      <section className="hero2">
        <h1>Mastercard promises partners a card program<br />in as fast as 15 days.</h1>
        <h1 className="dim">Its own engineers wait 6 to 8 months for an environment.</h1>
        <div className="herocard">
          <div className="fakeinput"><span className="dot" /> When can I tell the partner we go live?</div>
          <button className="pill dark big" onClick={() => go('/demo')}>Open the LaunchGate demo <i className="arr">→</i></button>
          <div className="chips"><span>6 to 8 months today</span><span>12 handoffs</span><span>LaunchGate: 1 request + the approvals that must stay human</span></div>
        </div>
      </section>

      <section className="black">
        <div className="tag">● The platform behind governed delivery</div>
        <h2>Give Mastercard's own engineers<br />the Product Express promise.</h2>
        <p>Externally, Mastercard already runs the one-governed-request model: Product Express pre-certifies partners, reduces onboarding conditions and shows status to every party across every phase. Internally, Business Development still waits on about twelve handoffs before a partner program can start. LaunchGate brings the same model inside: policy as code, an Azure AI Foundry agent that prepares the evidence pack, only the approvals that must stay human, and a record of every decision. Nothing deploys without a person.</p>
        <div className="row"><button className="pill light" onClick={() => go('/demo')}>Explore the demo <i className="arr">→</i></button><button className="ghost" onClick={() => go('/demo?role=exec')}>See the executive view</button></div>
      </section>

      <section className="challenge">
        <div className="tag grey">The challenge</div>
        <h2>Approval chains, not servers, are the delay.<br />Peers have already proved it can be fixed.</h2>
        <p>Mastercard told us a development environment takes six to eight months and about twelve handoffs. Capital One cut the average development environment build from three months to minutes. JPMorgan Chase codified its controls after measuring six to eighteen months per cloud service approval. The pattern is industry-wide, and regulators have started to say so.</p>
        <div className="statcard">
          <div><b>3 mo → min</b><span>Capital One, average development environment build time after moving to governed self-service</span></div>
          <div className="sep" />
          <div><b>6 to 18</b><span>months per cloud service approval at JPMorgan Chase before controls were codified</span></div>
          <div className="sep" />
          <div><b>78%</b><span>of engineering teams wait a day or more for DevOps help; 16% wait a week or more</span></div>
          <small>AWS case study: Capital One · FINOS, JPMorgan Chase "Secure by Design: Codified Controls" · Port, State of Internal Developer Portals 2025 · Morgan Stanley: 81 steps to ship one line (Team Topologies, 2026) · UK FCA: change boards approved over 90% of major changes (2021)</small>
        </div>
        <div className="chips light"><span>Deutsche Bank: 350+ policies as code, 3,000+ developers self-serving</span><span>Capital One built Cloud Custodian because every new cloud service needed its certs signed off by hand</span><span>Mastercard Verifiable Intent: "trust cannot be implied. It must be proven."</span><span>Gartner: 80% of large engineering orgs run platform teams by 2026</span></div>
      </section>

      <section className="how">
        <div className="tag grey">How it works</div>
        <h2>Agents prepare. Rules decide. People approve.<br /><span className="dimline">Including for Agent Pay.</span></h2>
        <div className="three">
          <div><i className="ic ic1" /><b>Ask once</b><span>A business owner or engineer answers a few plain questions. Secure defaults are applied so nobody chases twelve teams.</span></div>
          <div><i className="ic ic2" /><b>Rules decide, instantly</b><span>A deterministic readiness model scores the risk and runs every rule. Each result names the control it cites, from PCI DSS 4.0.1 to NIST 800-53, and the fix.</span></div>
          <div><i className="ic ic3" /><b>Humans stay in charge</b><span>An Azure AI Foundry agent on an open model drafts the evidence pack. Security and platform approve in one place. A GitHub environment gate enforces it. Agent Pay programs add a Verifiable Intent audit trail rule, Mastercard's own standard.</span></div>
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
