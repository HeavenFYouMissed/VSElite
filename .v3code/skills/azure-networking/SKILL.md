---
name: azure-networking
description: Azure networking, VNets, Private Endpoints, and DNS
keywords:
  - vnet
  - virtual network
  - private endpoint
  - DNS
  - NSG
  - load balancer
  - front door
  - CDN
  - firewall
  - subnet
alwaysApply: false
---

# Azure Networking Skill

## Network Architecture Patterns

### Public (Simple)
```
Internet → App Service/Container App (public endpoint)
```

### Private (Enterprise)
```
Internet → Front Door/App Gateway → VNet → Private Endpoint → App/DB
```

### Hub-Spoke (Multi-app)
```
Hub VNet (Firewall, DNS, VPN)
├── Spoke 1 (Web app)
├── Spoke 2 (API)
└── Spoke 3 (Data)
```

## Virtual Network Basics

```bash
# Create VNet
az network vnet create \
  -g myrg -n myvnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name default --subnet-prefix 10.0.0.0/24

# Add subnet
az network vnet subnet create \
  -g myrg --vnet-name myvnet \
  -n apps --address-prefix 10.0.1.0/24
```

## Private Endpoints

Connect to Azure services without exposing to public internet:

```bash
# Create private endpoint for PostgreSQL
az network private-endpoint create \
  -g myrg -n mydb-pe \
  --vnet-name myvnet --subnet apps \
  --connection-name mydb-conn \
  --private-connection-resource-id <postgres-resource-id> \
  --group-ids postgresqlServer
```

## Network Security Groups (NSGs)

```bash
# Create NSG rule
az network nsg rule create \
  -g myrg --nsg-name my-nsg \
  -n AllowHTTPS --priority 100 \
  --destination-port-ranges 443 \
  --protocol Tcp --access Allow --direction Inbound
```

### Default Deny Principle
- Block all inbound by default
- Only open ports you need
- Restrict source IPs when possible
- Use service tags (AzureCloud, Internet, VirtualNetwork)

## DNS

### Private DNS Zones
```bash
# Create private DNS zone
az network private-dns zone create -g myrg -n privatelink.postgres.database.azure.com

# Link to VNet
az network private-dns link vnet create \
  -g myrg -z privatelink.postgres.database.azure.com \
  -n mylink --virtual-network myvnet --registration-enabled false
```

## CDN / Front Door

```bash
# Create Front Door profile
az afd profile create -g myrg --profile-name myfd --sku Standard_AzureFrontDoor

# Add endpoint
az afd endpoint create -g myrg --profile-name myfd --endpoint-name myapp

# Add origin (your backend)
az afd origin create -g myrg --profile-name myfd \
  --origin-group-name default \
  --origin-name mybackend \
  --host-name myapp.azurewebsites.net
```

## Troubleshooting

| Issue | Check |
|-------|-------|
| Can't reach service | NSG rules, service firewall, DNS resolution |
| Timeout | Route tables, peering status, firewall rules |
| DNS not resolving | Private DNS zone linked? Record exists? |
| 403 from storage | Network rules, IP allowlist, service endpoint |

```bash
# Test connectivity
az network watcher test-connectivity \
  --source-resource <vm-id> \
  --dest-address <target-ip> --dest-port 443
```
