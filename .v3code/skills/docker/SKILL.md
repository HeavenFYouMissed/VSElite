---
name: docker
description: Docker and containerization patterns
keywords:
  - docker
  - container
  - dockerfile
  - compose
  - image
  - build
  - deploy
  - kubernetes
  - k8s
  - pod
alwaysApply: false
---

# Docker Skill

## Dockerfile Best Practices

### Multi-stage builds (keep images small)
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Layer Ordering (most stable → least stable)
1. Base image
2. System dependencies (apt-get)
3. Package manager files (package.json, lockfile)
4. Install dependencies (npm ci)
5. Copy source code
6. Build

### Security
- Never run as root — use `USER node`
- Don't copy secrets into images — use env vars or mounted secrets
- Use specific image tags (not `latest`)
- Scan images for vulnerabilities

## Docker Compose

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: pass
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 5s
      timeout: 5s
      retries: 5
```

## Common Commands

```bash
docker build -t myapp .
docker run -p 3000:3000 myapp
docker compose up -d
docker compose logs -f app
docker exec -it container_name sh
docker system prune -a  # clean up unused images/containers
```

## Debugging Containers
- `docker logs <container>` — see stdout/stderr
- `docker exec -it <container> sh` — shell into running container
- `docker inspect <container>` — full container metadata
- Check health: `docker ps` shows health status
