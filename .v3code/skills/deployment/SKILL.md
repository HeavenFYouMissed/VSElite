---
name: deployment
description: CI/CD, deployment pipelines, and production readiness
keywords:
  - deploy
  - CI
  - CD
  - pipeline
  - GitHub Actions
  - production
  - staging
  - environment
  - build
  - release
  - rollback
alwaysApply: false
---

# Deployment & CI/CD Skill

## GitHub Actions Basics

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
```

## Environment Strategy

| Environment | Purpose | Deploy Trigger |
|-------------|---------|----------------|
| Development | Local dev | Manual |
| Preview | PR review | On PR open |
| Staging | Pre-production testing | Merge to main |
| Production | Live users | Manual promote or tag |

## Production Readiness Checklist

- [ ] Health check endpoint (`/health` or `/healthz`)
- [ ] Structured logging (JSON format, correlation IDs)
- [ ] Environment variables for all config (no hardcoded values)
- [ ] Graceful shutdown (finish in-flight requests)
- [ ] Database migrations run before app starts
- [ ] Error monitoring (Sentry, DataDog, etc.)
- [ ] Secrets in vault/env, not in repo
- [ ] HTTPS enforced
- [ ] Rate limiting on public endpoints
- [ ] Backup and recovery plan for data

## Rollback Strategy

1. Keep previous deployment artifact available
2. Blue-green: switch traffic back to old version
3. Canary: route small % to new version, expand if healthy
4. Feature flags: disable new code without redeploying

## Docker Deployment

```bash
# Build and tag with git SHA
docker build -t myapp:$(git rev-parse --short HEAD) .

# Push to registry
docker push registry.example.com/myapp:abc123

# Deploy (update service to use new image)
docker service update --image myapp:abc123 myapp-service
```

## Zero-Downtime Deploys

- Use rolling updates (Kubernetes default)
- Ensure database migrations are backwards-compatible
- New code must handle old data format AND new data format during transition
- Health checks must pass before traffic is routed
