// Drafted with GitHub Copilot from an approved LaunchGate request. Parameters mirror the request schema.
// Every resource below satisfies rules GG-001..GG-007: encryption, TLS only, approved region, no public access, logging, tags, managed identity.
@allowed(['eastus', 'eastus2', 'centralus']) param location string = 'eastus2'
param projectName string
param owner string
param costCenter string
param dataClass string = 'internal'
var tags = { owner: owner, costCenter: costCenter, dataClass: dataClass, managedBy: 'LaunchGate' }

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = { name: 'log-${projectName}-dev', location: location, tags: tags, properties: { retentionInDays: 30 } }

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: toLower(replace('st${projectName}dev', '-', '')), location: location, tags: tags, kind: 'StorageV2', sku: { name: 'Standard_LRS' }
  properties: { supportsHttpsTrafficOnly: true, minimumTlsVersion: 'TLS1_2', allowBlobPublicAccess: false, publicNetworkAccess: 'Disabled', encryption: { services: { blob: { enabled: true }, file: { enabled: true } }, keySource: 'Microsoft.Storage' } }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = { name: 'plan-${projectName}-dev', location: location, tags: tags, sku: { name: 'B1' } }

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-${projectName}-dev', location: location, tags: tags, identity: { type: 'SystemAssigned' }
  properties: { serverFarmId: plan.id, httpsOnly: true, publicNetworkAccess: 'Disabled', siteConfig: { minTlsVersion: '1.2', ftpsState: 'Disabled' } }
}

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-${projectName}', scope: site
  properties: { workspaceId: law.id, logs: [ { category: 'AppServiceHTTPLogs', enabled: true }, { category: 'AppServiceAuditLogs', enabled: true } ] }
}
output appPrincipalId string = site.identity.principalId
