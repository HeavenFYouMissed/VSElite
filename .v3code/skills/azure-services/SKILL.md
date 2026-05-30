---
name: azure-services
description: Azure services overview, selection guide, and common patterns
keywords:
  - azure
  - cloud
  - resource group
  - subscription
  - managed identity
  - key vault
  - storage
  - cosmos
  - app insights
  - monitor
alwaysApply: false
---

# Azure Services Skill

## Service Selection Guide

### Compute
| Need | Service | When |
|------|---------|------|
| Web app/API | Container Apps | Containers, auto-scale, serverless pricing |
| Traditional hosting | App Service | .NET/Node/Python without containers |
| Event-driven | Functions | Triggers (HTTP, queue, timer, blob) |
| Heavy compute | AKS | Complex orchestration, custom networking |
| Batch jobs | Container Instances | One-off containers, no orchestration |

### Data
| Need | Service | When |
|------|---------|------|
| Relational | PostgreSQL Flexible | Standard SQL workloads |
| NoSQL document | Cosmos DB | Global distribution, multi-model |
| Cache | Redis Cache | Session store, query cache |
| Search | AI Search | Full-text + vector search |
| Files/Blobs | Storage Account | Object storage, static assets |

### AI & ML
| Need | Service | When |
|------|---------|------|
| LLM APIs | Azure OpenAI | GPT-4, embeddings, DALL-E |
| Custom models | AI Foundry | Fine-tuning, deployment |
| Search + RAG | AI Search | Vector + hybrid retrieval |
| Speech | Speech Services | STT, TTS, translation |

## Authentication Patterns

### Managed Identity (preferred)
```bash
# Assign identity to resource
az webapp identity assign --name myapp --resource-group myrg

# Grant access to Key Vault
az keyvault set-policy --name myvault \
  --object-id <identity-object-id> \
  --secret-permissions get list
```

### Service Principal (CI/CD)
```bash
az ad sp create-for-rbac --name myapp-ci \
  --role contributor \
  --scopes /subscriptions/<sub-id>/resourceGroups/<rg-name>
```

## Networking Patterns

- **Public** — default, accessible from internet (use for dev)
- **Private Endpoint** — accessible only from VNet
- **VNet Integration** — app can reach VNet resources
- **Service Endpoint** — restricts access to specific VNets

## Cost Control

- Use consumption/serverless tiers for development
- Set budgets and alerts in Cost Management
- Use spot instances for non-critical workloads
- Auto-scale with minimum instances = 0 (Container Apps)
- Delete unused resources (orphan check: `az resource list`)

## Monitoring (App Insights)

```typescript
import { ApplicationInsightsClient } from '@azure/monitor-opentelemetry';

const client = new ApplicationInsightsClient({
  connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
});

// Auto-collects: requests, dependencies, exceptions, metrics
// Custom events:
client.trackEvent({ name: 'UserSignup', properties: { plan: 'pro' } });
```

## Common CLI Commands

```bash
az login                                    # Authenticate
az account set -s <subscription-id>         # Switch subscription
az group create -n myrg -l eastus           # Create resource group
az group list -o table                      # List groups
az resource list -g myrg -o table           # List resources in group
az monitor metrics list --resource <id>     # View metrics
```
