---
name: azure-cost
description: Azure cost management, optimization, and billing analysis
keywords:
  - cost
  - billing
  - spending
  - optimize
  - budget
  - savings
  - reservation
  - advisor
  - orphaned
alwaysApply: false
---

# Azure Cost Management Skill

## Cost Analysis Commands

```bash
# View current costs by resource group
az consumption usage list --start-date 2024-01-01 --end-date 2024-01-31 \
  -o table --query "[].{Name:instanceName, Cost:pretaxCost, Currency:currency}"

# List all resources with pricing tier
az resource list -g mygroup -o table

# Check advisor recommendations (includes cost savings)
az advisor recommendation list --category Cost -o table
```

## Quick Wins for Cost Reduction

### 1. Find Orphaned Resources
```bash
# Unattached disks (paying for storage you're not using)
az disk list --query "[?managedBy==null].{Name:name, Size:diskSizeGb, RG:resourceGroup}" -o table

# Unused public IPs
az network public-ip list --query "[?ipConfiguration==null].{Name:name, RG:resourceGroup}" -o table

# Empty resource groups
az group list --query "[?properties.provisioningState=='Succeeded']" -o table
```

### 2. Right-Size VMs
```bash
# Check VM utilization
az monitor metrics list --resource <vm-id> \
  --metric "Percentage CPU" --interval PT1H \
  --aggregation Average --query "value[0].timeseries[0].data[-24:]"
```

### 3. Use Appropriate Tiers
| Service | Dev/Test | Production |
|---------|----------|------------|
| App Service | Free/B1 | S1+ or Premium |
| PostgreSQL | Burstable B1ms | General Purpose |
| Container Apps | Consumption | Dedicated |
| Redis | Basic C0 | Standard C1+ |
| Storage | LRS | GRS/ZRS |

### 4. Auto-Shutdown Dev Resources
```bash
# Schedule VM auto-shutdown
az vm auto-shutdown --resource-group myrg --name myvm --time 1900
```

## Budget Alerts

```bash
az consumption budget create \
  --budget-name monthly-limit \
  --amount 500 \
  --category cost \
  --time-grain monthly \
  --start-date 2024-01-01 \
  --end-date 2024-12-31
```

## Reservations & Savings Plans

- **Reserved Instances**: 1-3 year commitment, 30-72% savings on VMs/databases
- **Savings Plans**: Flexible commitment across compute services
- **Spot Instances**: Up to 90% discount for interruptible workloads
- **Dev/Test Pricing**: Reduced rates for non-production subscriptions

## Cost Tags Strategy

```bash
# Tag resources for cost tracking
az resource tag --tags Environment=Production Team=Backend Project=API \
  --ids <resource-id>

# Query costs by tag
az consumption usage list \
  --query "[?tags.Environment=='Production'].{Name:instanceName, Cost:pretaxCost}"
```

## Monthly Review Checklist

- [ ] Review top 10 cost drivers
- [ ] Check for orphaned resources
- [ ] Verify auto-scaling is working (not over-provisioned)
- [ ] Review Advisor cost recommendations
- [ ] Check reserved instance utilization
- [ ] Verify dev resources shut down after hours
