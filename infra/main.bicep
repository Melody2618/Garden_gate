// LaunchGate hosting: Azure Static Web App (portal + managed Functions API). Foundry project is created in the portal (see README).
param location string = 'eastus2'
param name string = 'launchgate'
resource swa 'Microsoft.Web/staticSites@2023-12-01' = { name: 'swa-${name}', location: location, sku: { name: 'Free', tier: 'Free' }, properties: {} }
output hostname string = swa.properties.defaultHostname
