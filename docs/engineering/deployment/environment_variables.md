# Environment Variables Reference

This document provides a comprehensive reference for all environment variables used in AccessAgents infrastructure and frontend applications.

## Overview

AccessAgents uses environment variables for configuration across three components:

1. **Infrastructure (CDK)** - Variables in `infra/.env`
2. **Frontend (Web App)** - Variables in `apps/web/.env.local`
3. **Local API Server** - Variables in `apps/api/.env`

## Infrastructure Environment Variables

These variables are used when deploying with AWS CDK. Create a `.env` file in the `infra/` directory.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Deployment environment | `development`, `staging`, `production` |
| `CDK_DEFAULT_ACCOUNT` | AWS Account ID (12 digits) | `123456789012` |
| `CDK_DEFAULT_REGION` | AWS Region for deployment | `us-east-1` |
| `BROWSERLESS_ENDPOINT` | Browserless.io WebSocket endpoint | `wss://chrome.browserless.io` |
| `BROWSERLESS_API_KEY` | Browserless.io API key | `your-api-key-here` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `AWS_PROFILE` | Named AWS CLI profile | Default profile | `accessagents-staging` |
| `AWS_ACCESS_KEY_ID` | AWS access key (CI/CD) | From AWS CLI | `AKIAXXXXXXXXXXXXXXXX` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (CI/CD) | From AWS CLI | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `AWS_REGION` | AWS region override | `CDK_DEFAULT_REGION` | `us-east-1` |

### Environment-Specific Configurations

The `NODE_ENV` variable controls environment-specific settings:

#### Development (`NODE_ENV=development`)

```bash
NODE_ENV=development
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1
BROWSERLESS_ENDPOINT=wss://chrome.browserless.io
BROWSERLESS_API_KEY=your-api-key

# Local database (optional - for local API server)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=accessagents
DATABASE_USER=postgres
DATABASE_PASSWORD=localdev123
```

| Setting | Value | Notes |
|---------|-------|-------|
| Aurora Min ACU | 0 | Scales to zero when idle |
| Aurora Max ACU | 2 | Limited scaling |
| NAT Gateways | 0 | Uses VPC endpoints |
| Log Retention | 3 days | Short retention |
| Deletion Protection | Off | Easy cleanup |

#### Staging (`NODE_ENV=staging`)

```bash
NODE_ENV=staging
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1
BROWSERLESS_ENDPOINT=wss://chrome.browserless.io
BROWSERLESS_API_KEY=your-api-key
```

| Setting | Value | Notes |
|---------|-------|-------|
| Aurora Min ACU | 0 | Scales to zero when idle |
| Aurora Max ACU | 4 | Moderate scaling |
| NAT Gateways | 0 | Uses VPC endpoints |
| Log Retention | 14 days | Medium retention |
| Deletion Protection | Off | Easy cleanup |

#### Production (`NODE_ENV=production`)

```bash
NODE_ENV=production
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1
BROWSERLESS_ENDPOINT=wss://chrome.browserless.io
BROWSERLESS_API_KEY=your-production-api-key
```

| Setting | Value | Notes |
|---------|-------|-------|
| Aurora Min ACU | 0.5 | Always warm |
| Aurora Max ACU | 16 | High scaling |
| NAT Gateways | 2 | Full internet access |
| Log Retention | 90 days | Long retention |
| Deletion Protection | On | Prevents accidents |

## Frontend Environment Variables

These variables configure the React web application. Create a `.env.local` file in `apps/web/`.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | REST API endpoint URL | `https://xxx.execute-api.us-east-1.amazonaws.com/staging` |
| `VITE_WS_URL` | WebSocket endpoint URL | `wss://xxx.execute-api.us-east-1.amazonaws.com/staging` |
| `VITE_AUTH_MODE` | Authentication mode | `saas` or `self-hosted` |

### Cognito Variables (Required when `VITE_AUTH_MODE=saas`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID | `us-east-1_xxxxxxxxx` |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID | `xxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `VITE_COGNITO_REGION` | Cognito region | `us-east-1` |
| `VITE_COGNITO_DOMAIN` | Cognito hosted UI domain | `accessagents-123456789012` |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment name | `development` | `staging` |
| `VITE_ENABLE_MSW` | Enable Mock Service Worker | `false` | `true` |

### Frontend Configuration Examples

#### Local Development (with MSW mocking)

```bash
NODE_ENV=development
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
VITE_AUTH_MODE=self-hosted
VITE_ENABLE_MSW=true
```

#### Local Development (with local API server)

```bash
NODE_ENV=development
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
VITE_AUTH_MODE=self-hosted
VITE_ENABLE_MSW=false
```

#### Staging (AWS Backend)

```bash
NODE_ENV=staging
VITE_API_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/staging
VITE_WS_URL=wss://def456uvw.execute-api.us-east-1.amazonaws.com/staging
VITE_AUTH_MODE=saas
VITE_COGNITO_USER_POOL_ID=us-east-1_AbCdEfGhI
VITE_COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j
VITE_COGNITO_REGION=us-east-1
VITE_ENABLE_MSW=false
```

#### Production (AWS Backend)

```bash
NODE_ENV=production
VITE_API_URL=https://api.accessagents.io
VITE_WS_URL=wss://ws.accessagents.io
VITE_AUTH_MODE=saas
VITE_COGNITO_USER_POOL_ID=us-east-1_XyZaBcDeF
VITE_COGNITO_CLIENT_ID=9z8y7x6w5v4u3t2s1r0q
VITE_COGNITO_REGION=us-east-1
VITE_ENABLE_MSW=false
```

## Local API Server Environment Variables

These variables configure the local Express API server for development. Create a `.env` file in `apps/api/`.

### Database Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `DATABASE_HOST` | PostgreSQL host | `localhost` | `localhost` |
| `DATABASE_PORT` | PostgreSQL port | `5432` | `5432` |
| `DATABASE_NAME` | Database name | `accessagents` | `accessagents` |
| `DATABASE_USER` | Database user | `postgres` | `postgres` |
| `DATABASE_PASSWORD` | Database password | - | `localdev123` |

### API Server Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | API server port | `3001` | `3001` |
| `NODE_ENV` | Environment | `development` | `development` |
| `JWT_SECRET` | JWT signing secret | - | `your-secret-key` |

### Browserless Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BROWSERLESS_ENDPOINT` | Browserless WebSocket URL | `wss://chrome.browserless.io` |
| `BROWSERLESS_API_KEY` | Browserless API key | `your-api-key` |

### Local API Server Example

```bash
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=accessagents
DATABASE_USER=postgres
DATABASE_PASSWORD=localdev123

# Server
PORT=3001
NODE_ENV=development
JWT_SECRET=local-development-secret-key

# Browserless
BROWSERLESS_ENDPOINT=wss://chrome.browserless.io
BROWSERLESS_API_KEY=your-api-key
```

## Lambda Environment Variables

These variables are automatically set by CDK during deployment. They are documented here for reference.

### Common Lambda Variables

| Variable | Description | Set By |
|----------|-------------|--------|
| `DATABASE_SECRET_ARN` | Secrets Manager ARN for DB credentials | CDK |
| `DATABASE_HOST` | Aurora cluster endpoint | CDK |
| `DATABASE_PORT` | Database port (5432) | CDK |
| `DATABASE_NAME` | Database name | CDK |
| `NODE_ENV` | Environment name | CDK |
| `NODE_OPTIONS` | Node.js options | CDK |

### Scan Manager Lambda Variables

| Variable | Description |
|----------|-------------|
| `USER_POOL_ID` | Cognito User Pool ID |
| `BEDROCK_AGENT_ID_PARAM` | SSM parameter for Bedrock Agent ID |
| `BEDROCK_AGENT_ALIAS_ID_PARAM` | SSM parameter for Agent Alias ID |
| `AUDITOR_FUNCTION_NAME` | Auditor Lambda function name |
| `WEBSOCKET_ENDPOINT` | WebSocket API endpoint |

### Auditor/Injector Lambda Variables

| Variable | Description |
|----------|-------------|
| `BROWSER_MODE` | Browser execution mode (`browserless`) |
| `BROWSERLESS_ENDPOINT` | Browserless WebSocket URL |
| `BROWSERLESS_API_KEY` | Browserless API key |

### Authorizer Lambda Variables

| Variable | Description |
|----------|-------------|
| `USER_POOL_ID` | Cognito User Pool ID |
| `USER_POOL_CLIENT_ID` | Cognito App Client ID |
| `COGNITO_REGION` | Cognito region |

## Getting Values from CDK Outputs

After deploying with CDK, retrieve configuration values:

```bash
# Get all outputs
cd infra
npx cdk outputs --all

# Get specific stack outputs
npx cdk outputs accessagents-staging-auth
npx cdk outputs accessagents-staging-api
```

### Mapping CDK Outputs to Frontend Variables

| CDK Output | Frontend Variable |
|------------|-------------------|
| `AuthStack.UserPoolId` | `VITE_COGNITO_USER_POOL_ID` |
| `AuthStack.UserPoolClientId` | `VITE_COGNITO_CLIENT_ID` |
| `ApiStack.RestApiEndpoint` | `VITE_API_URL` |
| `ApiStack.WebSocketEndpoint` | `VITE_WS_URL` |

## Security Best Practices

### Do's

- ✅ Use `.env.local` for local development (gitignored)
- ✅ Use AWS Secrets Manager for production secrets
- ✅ Use environment-specific API keys
- ✅ Rotate credentials regularly
- ✅ Use IAM roles instead of access keys when possible

### Don'ts

- ❌ Never commit `.env` files to source control
- ❌ Never share API keys in documentation or chat
- ❌ Never use production credentials in development
- ❌ Never hardcode secrets in source code

### Gitignore Configuration

Ensure these patterns are in your `.gitignore`:

```gitignore
# Environment files
.env
.env.local
.env.*.local
*.env

# AWS credentials
.aws/credentials
```

## Troubleshooting

### Variable Not Found

```
Error: VITE_API_URL is not defined
```

**Solution:** Ensure the variable is in `.env.local` and restart the dev server.

### CDK Can't Find AWS Credentials

```
Error: Unable to resolve AWS account to use
```

**Solution:** 
1. Run `aws configure` to set up credentials
2. Or set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
3. Verify with `aws sts get-caller-identity`

### Browserless Connection Failed

```
Error: WebSocket connection to browserless failed
```

**Solution:**
1. Verify `BROWSERLESS_API_KEY` is correct
2. Check Browserless.io dashboard for usage limits
3. Ensure `BROWSERLESS_ENDPOINT` uses `wss://` protocol

## Related Documentation

- [CDK Deployment Guide](./cdk_deployment_guide.md)
- [Local Setup Guide](../development/local_setup.md)
- [Infrastructure Overview](./infrastructure_overview.md)
