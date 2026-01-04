# Testing Quick Reference

Quick reference card for running tests across all environments.

## Commands by Environment

### Local Development

```bash
# Start services
docker-compose up -d

# Frontend unit tests
cd apps/web && npm run test

# Frontend E2E tests
cd apps/web && npx playwright test

# Core package tests
cd packages/core/agents/auditor && npm run test
cd packages/core/agents/orchestrator && npm run test

# Infrastructure build
cd infra && npm run build
```

### Staging

```bash
# Deploy to staging
cd infra && npm run deploy:staging

# Run E2E against staging
cd apps/web
VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/staging \
npx playwright test

# View Lambda logs
aws logs tail /aws/lambda/accessagents-staging-api-scan-manager --follow
```

### Production

```bash
# Deploy to production
cd infra && npm run deploy:prod

# Smoke test
curl https://api.accessagents.io/health

# Monitor metrics
aws cloudwatch get-metric-statistics --namespace AWS/Lambda ...
```

---

## Test File Locations

| Component | Test Location |
|-----------|---------------|
| Frontend | `apps/web/src/**/__tests__/` |
| Frontend E2E | `apps/web/e2e/` |
| Auditor | `packages/core/agents/auditor/src/__tests__/` |
| Orchestrator | `packages/core/agents/orchestrator/src/__tests__/` |
| Infrastructure | `infra/lib/**/__tests__/` |

---

## Coverage Targets

| Package | Statements | Branches | Functions |
|---------|-----------|----------|-----------|
| Frontend | 70% | 60% | 70% |
| Auditor | 80% | 70% | 80% |
| Orchestrator | 80% | 70% | 80% |

---

## Common Test Scenarios

### 1. Authentication

```bash
# Local: Uses mock JWT
VITE_AUTH_MODE=self-hosted

# Staging/Prod: Uses Cognito
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id xxx \
  --auth-parameters USERNAME=test@example.com,PASSWORD=xxx
```

### 2. API Endpoints

```bash
# Health check (no auth)
curl $API_URL/health

# Authenticated request
curl -H "Authorization: Bearer $TOKEN" $API_URL/sessions
```

### 3. WebSocket

```bash
wscat -c "$WS_URL?token=$TOKEN"
# Send: {"action":"subscribe","sessionId":"xxx"}
```

### 4. Database

```bash
# Local
docker exec -it accessagents-db psql -U postgres -d accessagents

# AWS (via bastion)
psql -h <cluster-endpoint> -U postgres -d accessagents
```

---

## Debugging Commands

### Local

```bash
# View Docker logs
docker-compose logs -f postgres

# Check running containers
docker-compose ps
```

### AWS

```bash
# Lambda logs
aws logs tail /aws/lambda/<function-name> --follow

# Lambda errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/<function-name> \
  --filter-pattern "ERROR"

# API Gateway logs
aws logs tail API-Gateway-Execution-Logs_xxx/staging --follow
```

---

## Pre-Deployment Checklist

- [ ] All local tests pass
- [ ] E2E tests pass against staging
- [ ] CDK diff reviewed
- [ ] Database migrations ready
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

---

## Environment Variables Quick Setup

### Development

```bash
# apps/web/.env
NODE_ENV=development
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
VITE_AUTH_MODE=self-hosted
VITE_ENABLE_MSW=true
```

### Staging

```bash
# apps/web/.env.staging
NODE_ENV=staging
VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/staging
VITE_AUTH_MODE=saas
VITE_COGNITO_USER_POOL_ID=us-east-1_xxx
VITE_ENABLE_MSW=false
```

### Production

```bash
# apps/web/.env.production
NODE_ENV=production
VITE_API_URL=https://api.accessagents.io
VITE_AUTH_MODE=saas
VITE_COGNITO_USER_POOL_ID=us-east-1_xxx
VITE_ENABLE_MSW=false
```

