---
name: azure-deploy
description: Azure deployment with azd, Bicep, Terraform, and Container Apps
keywords:
  - azure
  - deploy
  - azd
  - bicep
  - terraform
  - container apps
  - app service
  - function app
  - cloud
  - provision
alwaysApply: false
---

# Azure Deployment Skill

## Deployment Tools

| Tool | Best For |
|------|----------|
| `azd` (Azure Developer CLI) | Full-stack apps with infra-as-code |
| `az` (Azure CLI) | Individual resource management |
| Bicep | Azure-native IaC (ARM template successor) |
| Terraform | Multi-cloud IaC |

## Azure Developer CLI (azd)

### Quick Start
```bash
azd init           # Initialize project
azd provision      # Create Azure resources
azd deploy         # Deploy application code
azd up             # provision + deploy in one command
azd down           # Tear down resources
```

### Project Structure
```
/
├── azure.yaml          # azd project definition
├── infra/
│   ├── main.bicep      # Infrastructure definition
│   ├── main.parameters.json
│   └── modules/
│       ├── web.bicep
│       └── db.bicep
└── src/
    └── app/
```

### azure.yaml
```yaml
name: my-app
services:
  web:
    project: ./src/app
    language: typescript
    host: containerapp
```

## Common Azure Services

| Service | Use For |
|---------|---------|
| Container Apps | Containerized web apps, APIs, microservices |
| App Service | Traditional web hosting (no Docker needed) |
| Functions | Serverless event-driven compute |
| Static Web Apps | SPAs, static sites with optional API |
| AKS | Kubernetes workloads |
| Cosmos DB | NoSQL database (global distribution) |
| PostgreSQL Flexible | Managed PostgreSQL |
| Storage | Blobs, files, queues, tables |
| Key Vault | Secrets management |

## Bicep Basics

```bicep
param location string = resourceGroup().location
param appName string

resource webApp 'Microsoft.Web/sites@2022-09-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
    }
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name: '${appName}-plan'
  location: location
  sku: { name: 'B1' }
  kind: 'linux'
  properties: { reserved: true }
}
```

## Terraform for Azure

```hcl
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "main" {
  name     = "myapp-rg"
  location = "eastus"
}

resource "azurerm_container_app" "main" {
  name                = "myapp"
  resource_group_name = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id

  template {
    container {
      name   = "app"
      image  = "myregistry.azurecr.io/myapp:latest"
      cpu    = 0.5
      memory = "1Gi"
    }
  }
}
```

## Pre-Deployment Checklist

- [ ] All secrets in Key Vault or env vars (not in code)
- [ ] Health check endpoint configured
- [ ] Managed identity for service-to-service auth
- [ ] Scaling rules defined (min/max instances)
- [ ] Logging/monitoring configured (App Insights)
- [ ] Custom domain and SSL configured
- [ ] Backup strategy for databases
