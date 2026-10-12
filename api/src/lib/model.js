// Readiness Model: deterministic, explainable scoring that decides how much human review a request needs
// and which of Mastercard's ~12 traditional handoffs are automated, merged, or kept as a human decision.
// Weights are illustrative and transparent so a reviewer can audit every point.
const FACTORS = [
  { key: 'dataClass', label: 'Data classification', score: (r) => ({ internal: 5, confidential: 25, restricted: 45 }[r.dataClass] ?? 20), why: (r) => `${r.dataClass} data` },
  { key: 'publicEndpoint', label: 'Internet exposure', score: (r) => (r.publicEndpoint ? 20 : 0), why: (r) => (r.publicEndpoint ? 'public endpoint requested' : 'private only') },
  { key: 'authMethod', label: 'Credential handling', score: (r) => (r.authMethod === 'managed-identity' ? 0 : 15), why: (r) => (r.authMethod === 'managed-identity' ? 'managed identity' : 'stored secrets') },
  { key: 'region', label: 'Data residency', score: (r) => (['eastus', 'eastus2', 'centralus'].includes(r.region) ? 0 : 10), why: (r) => r.region },
  { key: 'tlsOnly', label: 'Transport security', score: (r) => (r.tlsOnly ? 0 : 10), why: (r) => (r.tlsOnly ? 'TLS only' : 'plain HTTP allowed') },
  { key: 'loggingEnabled', label: 'Observability', score: (r) => (r.loggingEnabled ? 0 : 5), why: (r) => (r.loggingEnabled ? 'logs on' : 'no logs') },
];
const TIERS = [
  { max: 15, tier: 'low', label: 'Low risk', approvers: ['platform'], sla: 'same day' },
  { max: 40, tier: 'medium', label: 'Medium risk', approvers: ['security', 'platform'], sla: '1–2 days' },
  { max: 70, tier: 'high', label: 'High risk', approvers: ['security', 'platform'], sla: '2–5 days' },
  { max: 100, tier: 'critical', label: 'Critical risk', approvers: ['security', 'compliance', 'platform'], sla: '1–2 weeks' },
];
// The twelve handoffs Maria described, as they typically occur in a regulated enterprise, and what LaunchGate does with each.
const HANDOFFS = [
  { n: 1, name: 'Intake ticket', today: 'Engineer files a ticket and waits for triage', mode: 'merged', with: 'One guided request' },
  { n: 2, name: 'Business justification', today: 'Email to business owner for sign-off and cost center', mode: 'merged', with: 'Owner and cost center captured in the request (rule GG-006)' },
  { n: 3, name: 'Data classification review', today: 'Data office classifies the workload', mode: 'automated', with: 'Classification drives the rule pack and risk tier' },
  { n: 4, name: 'Architecture review', today: 'Architecture board meeting', mode: 'automated', with: 'Standard template; Bicep drafted by GitHub Copilot' },
  { n: 5, name: 'Security questionnaire', today: 'Spreadsheet of 60+ questions', mode: 'automated', with: 'Rules GG-001..007 evaluated in seconds with PCI DSS / NIST citations' },
  { n: 6, name: 'Network / firewall request', today: 'Separate ticket to network team', mode: 'automated', with: 'Private endpoint enforced by rule GG-004 and template' },
  { n: 7, name: 'Identity and access request', today: 'IAM team creates service accounts', mode: 'automated', with: 'Managed identity required (GG-007); roles from Entra ID' },
  { n: 8, name: 'Compliance / PCI review', today: 'Compliance reviews evidence by hand', mode: 'human', with: 'Security approver reads the agent\'s evidence pack; kept human for confidential and restricted data' },
  { n: 9, name: 'Cost approval', today: 'Finance approves spend', mode: 'merged', with: 'Dev tier and cost center pre-approved in template' },
  { n: 10, name: 'Change ticket', today: 'Change advisory board', mode: 'human', with: 'Platform approver signs the deployment; GitHub environment gate enforces it' },
  { n: 11, name: 'Provisioning', today: 'Infra team runs scripts by hand', mode: 'automated', with: 'Deployment plan from the approved Bicep (simulated in prototype, Azure Deployment Environments in pilot)' },
  { n: 12, name: 'Logging and handover', today: 'Monitoring set up after the fact', mode: 'automated', with: 'Diagnostics enforced by rule GG-005; audit log is the handover record' },
];
const COMPLIANCE = [
  { id: 'PCI DSS 4.0.1', why: 'Mastercard is a founding member of the PCI Security Standards Council; any workload near cardholder data is in scope', coveredBy: ['GG-001', 'GG-002', 'GG-004', 'GG-005', 'GG-007', 'GG-008'] },
  { id: 'NYDFS 23 NYCRR 500', why: 'Mastercard is headquartered in Purchase, New York; the cybersecurity regulation requires access controls, encryption, audit trails and risk-based programs', coveredBy: ['GG-001', 'GG-002', 'GG-005', 'GG-007'] },
  { id: 'SOX ITGC', why: 'Change management and segregation of duties for a listed company', coveredBy: ['separation of duties', 'approval gate', 'audit log'] },
  { id: 'NIST SP 800-53 R5', why: 'Control catalogue Mastercard\'s policies can map to; used as the neutral reference for each rule', coveredBy: ['GG-001', 'GG-002', 'GG-003', 'GG-004', 'GG-005', 'GG-006', 'GG-007', 'GG-008'] },
  { id: 'GLBA Safeguards', why: 'Financial-institution customer data protections for partner bank programs', coveredBy: ['GG-001', 'GG-002', 'GG-004'] },
];

function score(req) {
  const factors = FACTORS.map((f) => ({ factor: f.label, points: f.score(req), because: f.why(req) }));
  const total = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const tier = TIERS.find((t) => total <= t.max);
  const handoffs = HANDOFFS.map((h) => {
    let mode = h.mode;
    if (h.n === 8 && tier.tier === 'low') mode = 'automated';
    if (h.n === 8 && tier.tier === 'critical') mode = 'human';
    return { ...h, mode };
  });
  if (req.program === 'agent-pay') handoffs.push({ n: 13, name: 'Agent governance review (new)', today: 'No defined path yet; agentic programs are new', mode: tier.tier === 'low' ? 'automated' : 'human', with: 'Verifiable Intent audit trail enforced by rule GG-009; security approver confirms agent scope' });
  const humanSteps = handoffs.filter((h) => h.mode === 'human').length;
  const applicable = COMPLIANCE.filter((c) => !(c.id.startsWith('PCI') && req.dataClass === 'internal') && !(c.id.startsWith('GLBA') && req.dataClass === 'internal'));
  const promise = req.program === 'card-program' ? 'Mastercard Product Express promises fintechs a card program in as fast as 15 days after contract. The internal path should not be the slowest part.' : req.program === 'agent-pay' ? 'Agent Pay is rolling out to every US cardholder by the holidays; partner integrations need a governed path measured in days, not quarters.' : 'Internal services inherit the same path; keep it short so partner programs do not queue behind them.';
  return { promise, riskScore: total, tier: tier.tier, tierLabel: tier.label, approvers: tier.approvers, todaySla: tier.sla, factors, handoffs, summary: { today: 12, automated: handoffs.filter((h) => h.mode === 'automated').length, merged: handoffs.filter((h) => h.mode === 'merged').length, human: humanSteps }, compliance: applicable };
}
module.exports = { score, HANDOFFS, COMPLIANCE };
