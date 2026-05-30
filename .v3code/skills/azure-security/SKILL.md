---
name: azure-security
description: Azure security, RBAC, managed identity, and Key Vault patterns
keywords:
  - azure security
  - RBAC
  - role
  - managed identity
  - key vault
  - secret
  - certificate
  - policy
  - compliance
  - Entra
  - OAuth
alwaysApply: false
---

# Azure Security Skill

## Managed Identity (Preferred Auth)

No secrets to manage — Azure handles token rotation automatically.

```bash
# Enable system-assigned identity
az webapp identity assign --name myapp --resource-group myrg

# Grant Key Vault access
az keyvault set-policy --name myvault \
  --object-id <identity-principal-id> \
  --secret-permissions get list
```

### Using in Code (Node.js)
```typescript
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

const credential = new DefaultAzureCredential();
const secretClient = new SecretClient('https://myvault.vault.azure.net', credential);
const secret = await secretClient.getSecret('my-api-key');
```

## RBAC (Role-Based Access Control)

### Common Built-In Roles
| Role | Scope |
|------|-------|
| Reader | View all resources |
| Contributor | Create/manage resources (no access management) |
| Owner | Full access including role assignments |
| Storage Blob Data Reader | Read blob data |
| Key Vault Secrets User | Read secrets |
| AcrPull | Pull images from container registry |

### Assign Role
```bash
az role assignment create \
  --assignee <principal-id> \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<account>
```

### Least Privilege Principle
- Assign the narrowest role possible
- Scope to specific resources (not subscription-wide)
- Use custom roles if built-in are too broad
- Review assignments quarterly

## Key Vault

```bash
# Create vault
az keyvault create --name myvault --resource-group myrg --location eastus

# Add secret
az keyvault secret set --vault-name myvault --name db-password --value "s3cur3!"

# Read secret
az keyvault secret show --vault-name myvault --name db-password --query value

# Rotate (set new version)
az keyvault secret set --vault-name myvault --name db-password --value "n3w-p@ss!"
```

## App Registration (OAuth)

```bash
# Create app registration
az ad app create --display-name "My API" \
  --sign-in-audience AzureADMyOrg

# Add API permission
az ad app permission add --id <app-id> \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope
```

## Security Checklist

- [ ] All service-to-service auth uses Managed Identity
- [ ] Secrets stored in Key Vault (never in code or env files in repo)
- [ ] Network access restricted (Private Endpoints, NSGs)
- [ ] Diagnostic logs enabled and sent to Log Analytics
- [ ] Azure Defender enabled for critical resources
- [ ] RBAC assignments follow least privilege
- [ ] Key rotation policy configured
- [ ] SSL/TLS enforced on all endpoints
