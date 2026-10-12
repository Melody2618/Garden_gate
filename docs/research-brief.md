# LaunchGate Research Brief: where the data comes from

Mastercard · Microsoft LEAD ASPIRE · 12 Oct 2026. Companion to the 3-page SOW. Nothing here is Discovery evidence; it is public context so every claim in the pitch has a source. Direct fetches of several sites were blocked in our environment, so quotes come from search excerpts: open each link and confirm wording before citing it aloud.

## 1. What Mastercard is doing today (public record)

| Area | Finding | Source |
|---|---|---|
| Cloud posture | About 60 data centers on a 100-Gig MPLS backbone; the CTO of Operations describes the estate as "one giant private cloud," mostly colocation | Fierce Network, 29 Oct 2024: https://www.fierce-network.com/cloud/mastercard-cto-dishes-network-gets-your-money-where-it-needs-go |
| Public cloud use | Uses AWS and Azure for internal application deployments; EUR 250M for three new French data centers | DCD, 23 Oct 2025: https://www.datacenterdynamics.com/en/news/mastercard-to-invest-250m-in-three-data-centers-in-france/ |
| Stated direction | FY2025 10-K: "deploying our cloud-native technology infrastructure ... to further enhance speed, resiliency and scalability" | SEC, Feb 2026: https://www.sec.gov/Archives/edgar/data/1141391/000114139126000013/ma-20251231.htm |
| AWS | Cloud Edge (APAC) built with AWS; customers onboard "up to four times faster"; AWS regions in India, Australia, Singapore, Hong Kong, Thailand | Mastercard press release, 16 Jun 2025: https://www.mastercard.com/news/ap/en/newsroom/press-releases/en/2025/mastercard-onboards-customers-up-to-four-times-faster-with-cloud-edge/ |
| Microsoft | Mastercard Labs R&D "powered by Azure"; Community Pass hosted on Azure; Agent Pay built with Azure OpenAI Service and Copilot Studio | Microsoft, 28 Jul 2020: https://news.microsoft.com/source/2020/07/28/mastercard-collaborates-with-microsoft-to-accelerate-innovation-across-digital-commerce-and-startup-ecosystems/ ; Mastercard, 29 Apr 2025: https://www.mastercard.com/us/en/news-and-trends/press/2025/april/mastercard-unveils-agent-pay-pioneering-agentic-payments-technology-to-power-commerce-in-the-age-of-ai.html |
| Platform engineering | On-prem Red Hat OpenShift Kubernetes "rolled out globally ... supporting tens of thousands of critical workloads"; stack named in postings: Jenkins, Ansible, Terraform, VMware, Prometheus, Dynatrace, Artifactory, AWS, Azure | Builder Enablement Program posting: https://builtin.com/job/senior-kubernetes-platform-automation-sre-engineer/7993501 |
| Policy as code | Lead Platform Engineering posting asks for "policy-as-code tools (OPA, Conftest, Sentinel)" and to "define and enforce configuration baselines, compliance policies"; a Kubernetes posting cites "PCI DSS ... compliance gates in CI pipelines" | https://zapply.jobs/jobs/9ad9b5a0-8bca-466b-a14e-5cd4389eda30/ ; https://zapply.jobs/jobs/7fc39858-93be-4f09-865c-6e4d3e0144b6/ |
| Azure IaC | Pune cloud-infrastructure roles: Azure, Terraform, Bicep, "policy enforcement" in IaC | https://careers.mastercard.com/us/en/job/R-281637/Principal-Cloud-Infrastructure-Engineer |
| Internal developer platform | PlatformCon talk, "A recipe for platform features adoption at Mastercard" | https://platformengineering.org/talks-library/a-recipe-for-platform-features-adoption-at-mastercard |
| Security segmentation | KubeCon NA 2024 talk by Mastercard engineers on microsegmentation with AdminNetworkPolicy | https://kccncna2024.sched.com/ |
| Compliance regime | Site Data Protection (SDP) program enforces PCI DSS validation on merchants and service providers; explains why "guardrails cannot be bypassed" | https://www.mastercard.com/global/en/business/cybersecurity-fraud-prevention/site-data-protection-pci.html |
| Audit-trail analogy | Verifiable Intent (Mar 2026, with Google): tamper-resistant record linking identity, agent instructions and outcome; a public Mastercard precedent for "agents act, humans and ledgers verify" | https://www.mastercard.com/us/en/news-and-trends/stories/2026/verifiable-intent.html |
| Financial inclusion (Giselle's area) | 2020 pledge: 1 billion people and 50 million micro and small businesses by 2025 (met); new 2030 goal: "connect and protect 500 million more people and small businesses" | https://www.mastercard.com/us/en/news-and-trends/stories/2026/mastercard-500-million-commitment.html |

**Not found in public sources:** any provisioning lead-time, deployment-frequency or environment-count metric; any announced AWS migration timeline; any use of ServiceNow, GitLab, Backstage or "golden paths". So the 6–8 month cycle, the 12 handoffs and the 6-month AWS move must be attributed to the interview only, and baselines must come from the client.

**How to use this in the pitch:** cite the 10-K line as Mastercard's own direction; cite the postings as evidence Mastercard already thinks in policy-as-code and PCI gates, so LaunchGate extends a practice rather than importing one; cite SDP and PCI DSS as the reason the gate must be deterministic and human-approved; cite Verifiable Intent as Mastercard's own audit-trail philosophy. Do not imply Mastercard is leaving its data centers.

## 4. External validation of the problem (verified sources)

| Finding | Source |
|---|---|
| 78% of engineering teams wait a day or more for SRE/DevOps assistance; 16% wait a week or more; 94% dissatisfied with self-service tools | Port, State of Internal Developer Portals 2025, https://www.port.io/state-of-internal-developer-portals |
| "3 different Jiras, a change ticket, and 81 individual steps" to get one line of code to production at Morgan Stanley (Gus Paul, Head of DevOps Platform) | Team Topologies, 22 Jan 2026, https://teamtopologies.com/news-blogs-newsletters/when-dora-metrics-meet-governance-in-banking |
| Change advisory boards approved over 90% of major changes; some firms rejected none in 2019; smaller, more frequent releases had higher success rates | UK FCA, Implementing Technology Change, 5 Feb 2021, https://www.fca.org.uk/publications/multi-firm-reviews/implementing-technology-change |
| Organizations spend about 58 working days per quarter on compliance audits and 3 working days per evidence request | Telos / Vanson Bourne, 13 Oct 2020, https://www.telos.com/press-release/survey-finds-compliance-activities-and-fines-cost-organizations-nearly-4m-per-year/ |
| 80% of large software engineering organizations will have platform engineering teams by 2026 | Gartner, https://www.gartner.com/en/experts/top-tech-trends-unpacked-series/platform-engineering-empowers-developers |
| Deutsche Bank: policy as code, 350+ infrastructure policies, 3,000+ developers consuming cloud autonomously | HashiCorp case study, https://www.hashicorp.com/en/case-studies/deutsche-bank |
| Synchrony: pre-approved Terraform modules, "minutes instead of days"; Lloyds: VM provisioning hours to 30 minutes | Tensure, Apr 2026; Bynd, 2026 |
| Only 8% of large organizations are cloud-mature; 42% rely on centralized platform teams | HashiCorp State of Cloud Strategy 2024 |
| Gartner: human oversight "remains essential"; 40%+ of agentic AI projects cancelled by 2027 partly for inadequate risk controls | Gartner, 25 Jun 2025 and Apr 2026 Hype Cycle |

Do not claim: that 6–8 months or 12 handoffs is an industry statistic (it is the interview); that any bank went "from months to minutes" (verified figures are days-to-minutes and hours-to-30-minutes, vendor-reported).
