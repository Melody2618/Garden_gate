// Make a deployment parameters file for dev-environment.bicep from a LaunchGate request.
// Usage: node infra/templates/make-params.js api/scenarios/agentpay.json > my.parameters.json
// Then:  az deployment group create -g <resource group> -f infra/templates/dev-environment.bicep -p @my.parameters.json
const { readFileSync } = require('fs');
const { toBicepParams } = require('../../api/src/lib/explain');
const file = process.argv[2];
if (!file) { console.error('Usage: node infra/templates/make-params.js <request.json>'); process.exit(1); }
try {
  const plan = toBicepParams(JSON.parse(readFileSync(file, 'utf8')));
  console.log(JSON.stringify(plan.parameters, null, 2));
  console.error(`Resource group: ${plan.resourceGroup}`);
} catch (e) { console.error('Cannot build parameters: ' + e.message); process.exit(1); }
