---
name: azure-diagnostics
description: Debugging Azure production issues with logs, metrics, and App Insights
keywords:
  - diagnose
  - troubleshoot
  - logs
  - KQL
  - App Insights
  - Log Analytics
  - monitor
  - alert
  - 500 error
  - slow
  - crash
alwaysApply: false
---

# Azure Diagnostics Skill

## Diagnostic Flow

1. **Check Resource Health** — is the service itself healthy?
2. **Check Metrics** — CPU, memory, requests, errors
3. **Check Logs** — application logs, platform logs
4. **Trace Requests** — end-to-end correlation

## KQL (Kusto Query Language) Essentials

### Application Insights Queries

```kql
// Recent errors
exceptions
| where timestamp > ago(1h)
| summarize count() by type, outerMessage
| order by count_ desc

// Slow requests
requests
| where timestamp > ago(1h) and duration > 5000
| project timestamp, name, duration, resultCode, url
| order by duration desc

// Dependency failures (database, external APIs)
dependencies
| where timestamp > ago(1h) and success == false
| summarize count() by target, type, resultCode
| order by count_ desc

// Error rate over time
requests
| where timestamp > ago(24h)
| summarize total=count(), errors=countif(resultCode >= 500) by bin(timestamp, 1h)
| extend errorRate = todouble(errors) / todouble(total) * 100
| project timestamp, errorRate
```

### Log Analytics

```kql
// Container App logs
ContainerAppConsoleLogs_CL
| where TimeGenerated > ago(1h)
| where Log_s contains "error" or Log_s contains "Error"
| project TimeGenerated, ContainerAppName_s, Log_s

// Function App invocations
FunctionAppLogs
| where TimeGenerated > ago(1h) and Level == "Error"
| project TimeGenerated, FunctionName_s, Message
```

## Common Azure Issues

### Container Apps
| Symptom | Cause | Fix |
|---------|-------|-----|
| 0 replicas | No traffic + scale-to-zero | Expected behavior, or set minReplicas=1 |
| Restart loop | App crash on startup | Check logs: `az containerapp logs show` |
| 502 errors | Health probe failing | Fix health endpoint, increase startup time |
| Slow cold start | Large image | Optimize Dockerfile, use smaller base image |

### App Service
| Symptom | Cause | Fix |
|---------|-------|-----|
| 503 | App pool crashed | Check App Service logs, restart |
| Slow | CPU/memory exhausted | Scale up or out |
| Deploy fails | Build error | Check deployment logs in Kudu |

### Functions
| Symptom | Cause | Fix |
|---------|-------|-----|
| Cold starts | Consumption plan | Use Premium or Flex plan |
| Timeout | Exceeds 5min limit | Break into smaller functions |
| Scale limit | Reached concurrent execution cap | Check host.json maxConcurrency |

## CLI Diagnostics

```bash
# Stream live logs
az webapp log tail --name myapp --resource-group myrg
az containerapp logs show --name myapp --resource-group myrg --follow

# Check health
az monitor metrics list --resource <resource-id> --metric "Http5xx"

# Resource health
az resource show --ids <resource-id> --query "properties.state"
```

## Alert Setup

```bash
az monitor metrics alert create \
  --name "high-error-rate" \
  --resource-group myrg \
  --scopes <resource-id> \
  --condition "avg Http5xx > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action-group myteam-alerts
```
