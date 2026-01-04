# Environment Testing Guide

Comprehensive testing guide for AccessAgents across local development, staging, and production environments.

## Environment Overview

| Environment | Database | Authentication | API | AI (Bedrock) |
|-------------|----------|----------------|-----|--------------|
| **Local (development)** | Docker PostgreSQL | Mock JWT | MSW mocks | AWS Bedrock |
| **Staging** | Aurora (0 ACU min) | Cognito | API Gateway | AWS Bedrock |
| **Production** | Aurora (0.5 ACU min) | Cognito | API Gateway | AWS Bedrock |

---

## Local Development Testing

### Prerequisites

```bash
# Required software
node -v           # v18+
docker --version  # Docker Desktop
aws --version     # AWS CLI (for Bedrock access)
```

### 1. Start Local Services

```bash
# From project root
docker-compose up -d

# Verify PostgreSQL is running
docker-compose ps
docker-compose logs postgres
```

**Expected output:**

```
accessagents-db  | database system is ready to accept connections
```

### 2. Verify Database Schema

```bash
# Connect to local PostgreSQL
docker exec -it accessagents-db psql -U postgres -d accessagents

# Check tables exist
\dt

# Expected tables:
#  organizations
#  users
#  scan_sessions
#  violations
#  reports
#  websocket_connections
```

### 3. Run Frontend with MSW Mocking

```bash
cd apps/web
cp .env.example .env

# Ensure these values in .env:
# NODE_ENV=development
# VITE_ENABLE_MSW=true
# VITE_AUTH_MODE=self-hosted

npm run dev
```

### 4. Frontend Unit Tests

```bash
cd apps/web

# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- src/features/scan/__tests__/useScan.test.ts

# Run tests in watch mode
npm run test:watch
```

**Expected coverage targets:**

| Category | Target |
|----------|--------|
| Statements | > 70% |
| Branches | > 60% |
| Functions | > 70% |
| Lines | > 70% |

### 5. Frontend E2E Tests (Playwright)

```bash
cd apps/web

# Install Playwright browsers
npx playwright install

# Run E2E tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run specific test
npx playwright test e2e/scan-flow.spec.ts
```

**E2E Test Files:**

| File | Description |
|------|-------------|
| `accessibility.spec.ts` | Page accessibility compliance |
| `auth-flow.spec.ts` | Login, logout, session management |
| `scan-flow.spec.ts` | Start scan, view progress |
| `history-flow.spec.ts` | View scan history |
| `error-recovery.spec.ts` | Error handling flows |

### 6. Core Package Tests

```bash
# Auditor package
cd packages/core/agents/auditor
npm install
npm run test
npm run test:coverage

# Orchestrator package
cd packages/core/agents/orchestrator
npm install
npm run test
npm run test:coverage
```

### 7. Infrastructure Tests (CDK)

```bash
cd infra
npm run build

# Synthesize CloudFormation (requires Docker)
NODE_ENV=development npm run synth:dev

# Diff against deployed stack
NODE_ENV=development npm run diff:dev
```

### 8. Test Bedrock Integration Locally

Bedrock is the only cloud service used in local development:

```bash
# Configure AWS credentials
aws configure

# Test Bedrock access
aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-sonnet-20240229-v1:0 \
  --content-type application/json \
  --body '{"anthropic_version":"bedrock-2023-05-31","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}' \
  --region us-east-1 \
  output.json

cat output.json
```

---

## Staging Environment Testing

### Prerequisites

1. Deploy staging infrastructure:

```bash
cd infra
NODE_ENV=staging npm run deploy:staging
```

2. Get CDK outputs:

```bash
npx cdk outputs --all
```

3. Configure frontend for staging:

```bash
cd apps/web
cp .env.example .env.staging

# Edit with staging values from CDK outputs
VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/staging
VITE_WS_URL=wss://xxx.execute-api.us-east-1.amazonaws.com/staging
VITE_AUTH_MODE=saas
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_ENABLE_MSW=false
```

### 1. API Health Check

```bash
# Get API endpoint from CDK outputs
API_URL="https://xxx.execute-api.us-east-1.amazonaws.com/staging"

# Test health endpoint
curl "$API_URL/health"
# Expected: {"status":"healthy","environment":"staging"}
```

### 2. Authentication Testing

**Create Test User:**

```bash
# Create user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_xxxxxxxxx \
  --username test@example.com \
  --user-attributes Name=email,Value=test@example.com \
  --temporary-password TempPass123! \
  --region us-east-1

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_xxxxxxxxx \
  --username test@example.com \
  --password TestPass123! \
  --permanent \
  --region us-east-1
```

**Login Test:**

```bash
# Get tokens
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id xxxxxxxxxxxxxxxxxxxxxxxxxx \
  --auth-parameters USERNAME=test@example.com,PASSWORD=TestPass123! \
  --region us-east-1
```

### 3. API Integration Tests

```bash
# Use the ID token from login
TOKEN="eyJraWQi..."

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
  "$API_URL/sessions"

# Create a scan session
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetUrl":"https://example.com","wcagLevel":"AA"}' \
  "$API_URL/scans"
```

### 4. WebSocket Testing

```bash
# Install wscat if needed
npm install -g wscat

# Connect to WebSocket (requires auth token)
WS_URL="wss://xxx.execute-api.us-east-1.amazonaws.com/staging"
wscat -c "$WS_URL?token=$TOKEN"

# Send subscribe message
{"action":"subscribe","sessionId":"xxx"}
```

### 5. Database Verification

```bash
# Get database credentials
aws secretsmanager get-secret-value \
  --secret-id accessagents-staging-database/db-credentials \
  --query SecretString --output text | jq .

# Connect via Session Manager or bastion
# Verify tables exist and RLS is working
```

### 6. Lambda Log Verification

```bash
# View ScanManager logs
aws logs tail /aws/lambda/accessagents-staging-api-scan-manager --follow

# View Authorizer logs
aws logs tail /aws/lambda/accessagents-staging-api-authorizer --follow

# View WebSocket logs
aws logs tail /aws/lambda/accessagents-staging-api-websocket --follow
```

### 7. Bedrock Agent Testing

```bash
# Get Agent ID from CDK outputs
AGENT_ID="xxxxxxxxxx"
AGENT_ALIAS_ID="xxxxxxxxxx"

# Invoke agent directly
aws bedrock-agent-runtime invoke-agent \
  --agent-id $AGENT_ID \
  --agent-alias-id $AGENT_ALIAS_ID \
  --session-id "test-session-$(date +%s)" \
  --input-text "Scan https://example.com for accessibility issues" \
  --region us-east-1 \
  output.json
```

### 8. E2E Tests Against Staging

```bash
cd apps/web

# Run E2E against staging
VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/staging \
VITE_AUTH_MODE=saas \
npx playwright test
```

---

## Production Environment Testing

### Pre-Deployment Checklist

| Item | Verification Command |
|------|---------------------|
| All staging tests pass | `npm run test:staging` |
| Database migrations applied | Check migration table |
| Secrets rotated | Check Secrets Manager |
| CDK diff shows expected changes | `npm run diff:prod` |
| Backup verified | Check Aurora snapshots |

### 1. Smoke Tests After Deployment

```bash
# Deploy to production
cd infra
NODE_ENV=production npm run deploy:prod

# Verify health
curl "https://api.accessagents.io/health"
# Expected: {"status":"healthy","environment":"production"}
```

### 2. Critical Path Testing

**Test 1: Authentication Flow**

```bash
# Via frontend
1. Navigate to https://app.accessagents.io
2. Click "Sign Up"
3. Complete registration
4. Verify email
5. Login
6. Verify dashboard loads
```

**Test 2: Scan Flow**

```bash
1. Login to application
2. Enter URL to scan (e.g., https://example.com)
3. Start scan
4. Verify real-time progress updates
5. Wait for completion
6. Verify report displays correctly
```

**Test 3: History Flow**

```bash
1. Navigate to History page
2. Verify previous scans appear
3. Click on a scan
4. Verify report loads correctly
```

### 3. Performance Testing

```bash
# Load test with k6
k6 run --vus 10 --duration 30s load-test.js

# Example load-test.js:
# import http from 'k6/http';
# export default function() {
#   http.get('https://api.accessagents.io/health');
# }
```

### 4. Monitoring Verification

**CloudWatch Dashboards:**

```bash
# Check Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=accessagents-production-api-scan-manager \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

**Aurora Metrics:**

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name ServerlessDatabaseCapacity \
  --dimensions Name=DBClusterIdentifier,Value=accessagents-production-database-cluster \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

### 5. Rollback Procedure

If issues are found in production:

```bash
# 1. Check CloudWatch for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/accessagents-production-api-scan-manager \
  --filter-pattern "ERROR"

# 2. Rollback to previous version
cd infra
git checkout <previous-commit>
NODE_ENV=production npm run deploy:prod

# 3. Verify rollback
curl "https://api.accessagents.io/health"
```

---

## Test Data Management

### Local Development

Test data is reset when Docker containers are recreated:

```bash
# Reset database
docker-compose down -v
docker-compose up -d
```

### Staging

```bash
# Clear test data (run in psql)
DELETE FROM violations WHERE session_id IN (
  SELECT id FROM scan_sessions WHERE target_url LIKE '%test%'
);
DELETE FROM scan_sessions WHERE target_url LIKE '%test%';
```

### Production

**Never delete production data manually.** Use the application's delete functionality.

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd apps/web && npm ci
      - run: cd apps/web && npm run test:coverage
      - run: cd apps/web && npx playwright install --with-deps
      - run: cd apps/web && npx playwright test

  infrastructure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd infra && npm ci
      - run: cd infra && npm run build
      - run: cd infra && NODE_ENV=development npx cdk synth
```

---

## Test Environment Variables Reference

### Local Development

```bash
# apps/web/.env
NODE_ENV=development
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
VITE_AUTH_MODE=self-hosted
VITE_ENABLE_MSW=true

# infra/.env
NODE_ENV=development
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=accessagents
DATABASE_USER=postgres
DATABASE_PASSWORD=localdev123
```

### Staging

```bash
# apps/web/.env.staging
NODE_ENV=staging
VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/staging
VITE_WS_URL=wss://xxx.execute-api.us-east-1.amazonaws.com/staging
VITE_AUTH_MODE=saas
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_ENABLE_MSW=false
```

### Production

```bash
# apps/web/.env.production
NODE_ENV=production
VITE_API_URL=https://api.accessagents.io
VITE_WS_URL=wss://ws.accessagents.io
VITE_AUTH_MODE=saas
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_ENABLE_MSW=false
```

---

## Troubleshooting

### Local Development Issues

**Docker PostgreSQL not starting:**

```bash
docker-compose logs postgres
# Check for port conflicts
lsof -i :5432
```

**MSW not intercepting requests:**

```bash
# Verify VITE_ENABLE_MSW=true in .env
# Check browser console for MSW initialization
```

### Staging Issues

**API returning 401:**

```bash
# Verify token is valid
aws cognito-idp get-user --access-token $TOKEN

# Check authorizer logs
aws logs tail /aws/lambda/accessagents-staging-api-authorizer
```

**Lambda timeout:**

```bash
# Check Lambda configuration
aws lambda get-function-configuration \
  --function-name accessagents-staging-api-scan-manager

# Increase timeout if needed
aws lambda update-function-configuration \
  --function-name accessagents-staging-api-scan-manager \
  --timeout 300
```

### Production Issues

**Aurora connection errors:**

```bash
# Check Aurora status
aws rds describe-db-clusters \
  --db-cluster-identifier accessagents-production-database-cluster

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxxxxxxx
```

**Bedrock agent not responding:**

```bash
# Check agent status
aws bedrock-agent get-agent --agent-id $AGENT_ID

# Check agent alias
aws bedrock-agent get-agent-alias --agent-id $AGENT_ID --agent-alias-id $AGENT_ALIAS_ID
```

---

## Summary

| Environment | Primary Tests | Secondary Tests |
|-------------|---------------|-----------------|
| **Local** | Unit tests, MSW integration | E2E with Playwright |
| **Staging** | API integration, Auth flows | Load testing, E2E |
| **Production** | Smoke tests, Critical paths | Monitoring, Alerting |

Always test in order: **Local → Staging → Production**

