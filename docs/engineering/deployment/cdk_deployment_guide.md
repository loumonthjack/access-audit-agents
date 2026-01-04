# CDK Deployment Guide

This document provides comprehensive step-by-step instructions for deploying AccessAgents infrastructure using AWS CDK.

## Overview

AccessAgents uses AWS CDK (Cloud Development Kit) to define infrastructure as code. The infrastructure includes:

- **Amazon Cognito** - User authentication and authorization
- **Aurora PostgreSQL Serverless v2** - Database with auto-scaling
- **API Gateway** - REST and WebSocket APIs
- **AWS Lambda** - Serverless compute for scan operations
- **Amazon Bedrock** - AI agent for accessibility remediation

## Prerequisites

### Required Software

| Requirement | Version | Installation |
|-------------|---------|--------------|
| Node.js | 18.x+ | [nodejs.org](https://nodejs.org) |
| npm | 9.x+ | Included with Node.js |
| AWS CLI | 2.x | [AWS CLI Install Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| Docker | 20.x+ | [Docker Desktop](https://www.docker.com/products/docker-desktop) |
| Git | 2.x+ | [git-scm.com](https://git-scm.com) |

### AWS Account Requirements

Before deploying, ensure your AWS account has:

1. **Bedrock Model Access** - Request access to Amazon Nova Pro in the AWS Console:
   - Navigate to Amazon Bedrock → Model access
   - Request access to `amazon.nova-pro-v1:0`
   - Wait for approval (usually instant for Nova models)

2. **Service Quotas** - Verify sufficient quotas for:
   - VPCs (default: 5 per region)
   - Elastic IPs (needed for NAT Gateways in production)
   - Lambda concurrent executions

3. **IAM Permissions** - The deploying user/role needs permissions for:

| Service | Required Permissions |
|---------|---------------------|
| CloudFormation | Full access (create/update/delete stacks) |
| Cognito | Full access (user pools, identity pools) |
| RDS | Aurora cluster management |
| Lambda | Function management |
| API Gateway | REST and WebSocket API management |
| IAM | Role and policy creation |
| VPC | Networking resources |
| Secrets Manager | Credential storage |
| Bedrock | Agent management |
| SSM | Parameter Store access |
| S3 | Bucket management |

**Recommended**: Use `AdministratorAccess` for initial deployment, then create a scoped-down role for CI/CD.

### External Service Requirements

| Service | Purpose | Setup |
|---------|---------|-------|
| Browserless.io | Browser automation for scanning | [Sign up](https://browserless.io) - Free tier: 6 hours/month |

## Project Structure

```
infra/
├── bin/
│   └── app.ts                    # CDK app entry point
├── lib/
│   ├── config/
│   │   ├── environments.ts       # Environment configurations
│   │   └── index.ts              # Config exports
│   ├── stacks/
│   │   ├── auth-stack.ts         # Cognito User Pool
│   │   ├── database-stack.ts     # Aurora PostgreSQL + VPC
│   │   ├── api-stack.ts          # API Gateway + Lambda functions
│   │   └── bedrock-stack.ts      # Bedrock Agent + Action Groups
│   └── lambdas/
│       ├── auditor/              # Axe-core accessibility scanning
│       ├── injector/             # DOM fix application
│       ├── scan-manager/         # Scan orchestration
│       ├── websocket/            # Real-time updates
│       ├── authorizer/           # JWT validation
│       ├── migration-runner/     # Database migrations
│       └── shared/               # Shared utilities
├── migrations/
│   ├── 001_initial_schema.sql    # Initial database schema
│   └── 002_add_violation_screenshots.sql
├── schemas/
│   ├── auditor-openapi.yaml      # Bedrock Auditor action schema
│   └── injector-openapi.yaml     # Bedrock Injector action schema
├── .env.example                  # Environment template
├── cdk.json                      # CDK configuration
├── package.json
└── tsconfig.json
```

## Stack Architecture

The stacks must be deployed in order due to dependencies:

```
AuthStack → DatabaseStack → ApiStack → BedrockStack
```

| Stack | Dependencies | Resources Created |
|-------|--------------|-------------------|
| **AuthStack** | None | Cognito User Pool, App Client, Identity Pool, Hosted UI Domain |
| **DatabaseStack** | None | VPC, Subnets, Aurora Cluster, Security Groups, VPC Endpoints, Secrets Manager |
| **ApiStack** | Auth, Database | REST API, WebSocket API, Lambda Functions (Auditor, Injector, ScanManager, WebSocket, Authorizer, MigrationRunner) |
| **BedrockStack** | Api | Bedrock Agent, Action Groups, S3 Schema Bucket, SSM Parameters |

## Environment Configuration

AccessAgents supports three deployment environments:

| Environment | Use Case | Aurora ACU | NAT Gateways | Cost |
|-------------|----------|------------|--------------|------|
| `development` | Local testing | 0-2 (scales to 0) | 0 | ~$0-5/month |
| `staging` | Pre-production testing | 0-4 (scales to 0) | 0 | ~$5-20/month |
| `production` | Live deployment | 0.5-16 (always warm) | 2 | ~$120+/month |

### Environment Variables Reference

Create a `.env` file in the `infra/` directory. See [Environment Variables Reference](./environment_variables.md) for complete documentation.

**Quick Setup:**

```bash
cd infra
cp .env.example .env
```

**Required Variables:**

```bash
# Environment (development | staging | production)
NODE_ENV=staging

# AWS Account Configuration
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1

# Browserless.io (required for scanning)
BROWSERLESS_ENDPOINT=wss://chrome.browserless.io
BROWSERLESS_API_KEY=your-api-key-here
```

## Step-by-Step Deployment

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-org/accessagents.git
cd accessagents

# Install infrastructure dependencies
cd infra
npm install
```

### Step 2: Configure AWS Credentials

**Option A: AWS CLI (Recommended for local development)**

```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region
```

**Option B: Environment Variables (CI/CD)**

```bash
export AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
export AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export AWS_REGION=us-east-1
```

**Option C: Named Profile**

```bash
# In ~/.aws/credentials
[accessagents-staging]
aws_access_key_id = AKIAXXXXXXXXXXXXXXXX
aws_secret_access_key = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Set profile
export AWS_PROFILE=accessagents-staging
```

**Verify credentials:**

```bash
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-user"
}
```

### Step 3: Configure Environment

```bash
cd infra
cp .env.example .env
```

Edit `.env` with your values:

```bash
NODE_ENV=staging
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1
BROWSERLESS_ENDPOINT=wss://chrome.browserless.io
BROWSERLESS_API_KEY=your-browserless-api-key
```

Load environment variables:

```bash
source .env
# Or use: export $(cat .env | xargs)
```

### Step 4: Bootstrap CDK (First Time Only)

CDK bootstrap creates resources CDK needs to deploy (S3 bucket, IAM roles):

```bash
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION
```

Expected output:
```
 ⏳  Bootstrapping environment aws://123456789012/us-east-1...
 ✅  Environment aws://123456789012/us-east-1 bootstrapped
```

### Step 5: Preview Changes (Optional)

See what will be deployed without making changes:

```bash
# Synthesize CloudFormation templates
npx cdk synth

# Compare with existing deployment
npx cdk diff
```

### Step 6: Deploy All Stacks

**Using npm scripts (recommended):**

```bash
# Development
npm run deploy:dev

# Staging
npm run deploy:staging

# Production
npm run deploy:prod
```

**Using CDK directly:**

```bash
NODE_ENV=staging npx cdk deploy --all --require-approval never
```

**Deploy individual stacks:**

```bash
# Deploy in order
npx cdk deploy accessagents-staging-auth
npx cdk deploy accessagents-staging-database
npx cdk deploy accessagents-staging-api
npx cdk deploy accessagents-staging-bedrock
```

### Step 7: Note Stack Outputs

After deployment, CDK outputs important values:

```bash
npx cdk outputs --all
```

Key outputs to note:

| Output | Description | Used By |
|--------|-------------|---------|
| `UserPoolId` | Cognito User Pool ID | Frontend |
| `UserPoolClientId` | Cognito App Client ID | Frontend |
| `ApiEndpoint` | REST API URL | Frontend |
| `WebSocketEndpoint` | WebSocket URL | Frontend |
| `ClusterEndpoint` | Aurora database endpoint | Migrations |
| `SecretArn` | Database credentials ARN | Debugging |
| `AgentId` | Bedrock Agent ID | Debugging |
| `MigrationRunnerLambdaName` | Lambda for migrations | Post-deployment |

### Step 8: Run Database Migrations

After deploying, initialize the database schema:

**Option A: Using Migration Runner Lambda (Recommended)**

```bash
# Get the Lambda function name from outputs
MIGRATION_LAMBDA=$(aws cloudformation describe-stacks \
  --stack-name accessagents-staging-api \
  --query 'Stacks[0].Outputs[?OutputKey==`MigrationRunnerLambdaName`].OutputValue' \
  --output text)

# Invoke the migration runner
aws lambda invoke \
  --function-name $MIGRATION_LAMBDA \
  --payload '{}' \
  response.json

cat response.json
```

**Option B: Direct Database Connection (Advanced)**

```bash
# Get database credentials
aws secretsmanager get-secret-value \
  --secret-id accessagents-staging-database/db-credentials \
  --query SecretString --output text | jq .

# Connect via bastion/Session Manager and run migrations
psql -h <cluster-endpoint> -U postgres -d accessagents \
  -f migrations/001_initial_schema.sql
```

### Step 9: Configure Frontend

Update the web app with deployed endpoints:

```bash
cd ../apps/web
cp .env.example .env.local
```

Edit `apps/web/.env.local`:

```bash
NODE_ENV=staging
VITE_API_URL=https://xxx.execute-api.us-east-1.amazonaws.com/staging
VITE_WS_URL=wss://xxx.execute-api.us-east-1.amazonaws.com/staging
VITE_AUTH_MODE=saas
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_REGION=us-east-1
VITE_ENABLE_MSW=false
```

### Step 10: Verify Deployment

**Test health endpoint:**

```bash
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/staging/health
```

Expected response:
```json
{"status": "healthy", "environment": "staging"}
```

**Test frontend:**

```bash
cd apps/web
npm run dev
# Open http://localhost:5173
# Sign up, login, and start a scan
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript |
| `npm run deploy:dev` | Deploy with development config |
| `npm run deploy:staging` | Deploy with staging config |
| `npm run deploy:prod` | Deploy with production config |
| `npm run destroy:dev` | Destroy development stacks |
| `npm run destroy:staging` | Destroy staging stacks |
| `npm run destroy:prod` | Destroy production stacks |
| `npm run diff:dev` | Show development changes |
| `npm run synth:dev` | Synthesize development CloudFormation |

## Stack Details

### Authentication Stack (AuthStack)

Creates Cognito resources for user authentication:

| Resource | Configuration |
|----------|---------------|
| User Pool | Email sign-up, auto-verification |
| Password Policy | 8+ chars, upper/lower/digits (symbols in prod) |
| App Client | OAuth 2.0 authorization code flow |
| Token Validity | Access: 1 hour, Refresh: 30 days |
| Hosted UI | Custom domain prefix |

**Callback URLs by Environment:**

| Environment | Callback URLs |
|-------------|---------------|
| Development/Staging | `http://localhost:5173/callback`, `http://localhost:3000/callback` |
| Production | `https://app.accessagents.io/callback` |

### Database Stack (DatabaseStack)

Creates Aurora PostgreSQL Serverless v2 with VPC:

| Resource | Configuration |
|----------|---------------|
| VPC | 2-3 AZs, public/private/isolated subnets |
| Aurora | PostgreSQL 15.8, Serverless v2 |
| Encryption | Storage encryption enabled |
| Credentials | Auto-generated, stored in Secrets Manager |

**Scaling by Environment:**

| Environment | Min ACU | Max ACU | Backup Retention |
|-------------|---------|---------|------------------|
| Development | 0 | 2 | 1 day |
| Staging | 0 | 4 | 7 days |
| Production | 0.5 | 16 | 30 days |

**VPC Endpoints (when NAT Gateways = 0):**

- Secrets Manager
- SSM Parameter Store
- Bedrock Runtime
- Bedrock Agent Runtime
- API Gateway
- Lambda

### API Stack (ApiStack)

Creates REST and WebSocket APIs with Lambda functions:

| Lambda | Memory | Timeout | VPC | Purpose |
|--------|--------|---------|-----|---------|
| Auditor | 2048 MB | 60s+ | No | Axe-core scanning via Browserless |
| Injector | 1024 MB | 60s+ | No | DOM modifications via Browserless |
| ScanManager | 512-2048 MB | 150-1500s | Yes | Orchestration |
| WebSocket | 256 MB | 30s | Yes | Real-time updates |
| Authorizer | 128 MB | 10s | No | JWT validation |
| MigrationRunner | 256 MB | 300s | Yes | Database migrations |

**API Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/scans` | Start a new scan |
| GET | `/scans/{sessionId}` | Get scan status |
| GET | `/sessions` | List user sessions |
| DELETE | `/sessions/{sessionId}` | Delete a session |
| GET | `/reports/{sessionId}` | Get scan report |
| GET | `/reports/{sessionId}/export` | Export report |
| GET | `/health` | Health check (no auth) |

### Bedrock Stack (BedrockStack)

Creates Bedrock Agent for AI-powered remediation:

| Resource | Configuration |
|----------|---------------|
| Foundation Model | Amazon Nova Pro v1 |
| Agent | Orchestrator with system prompt |
| Action Groups | Auditor, Injector |
| Session TTL | 30 minutes |

## Troubleshooting

### Common Issues

#### CDK Bootstrap Errors

```
Error: Need to perform bootstrapping
```

**Solution:** Run `npx cdk bootstrap aws://ACCOUNT/REGION` first.

#### Docker Not Running

```
Error: Cannot connect to the Docker daemon
```

**Solution:** Start Docker Desktop or the Docker service.

#### VPC Quota Exceeded

```
Error: You have reached your VPC limit
```

**Solution:** Request a VPC quota increase or delete unused VPCs.

#### Lambda Timeout

```
Error: Task timed out after X seconds
```

**Solution:** Increase timeout in environment config or optimize Lambda code.

#### Bedrock Model Access Denied

```
Error: Access denied to model amazon.nova-pro-v1:0
```

**Solution:** Request model access in AWS Console → Bedrock → Model access.

#### Database Connection Failed

```
Error: Connection refused to Aurora cluster
```

**Solution:** 
1. Verify Lambda is in correct VPC subnet
2. Check security group allows port 5432
3. Verify VPC endpoints are configured (if no NAT)

### Useful Commands

```bash
# View all stacks
npx cdk list

# View stack outputs
npx cdk outputs accessagents-staging-api

# Compare local vs deployed
npx cdk diff

# View CloudWatch logs
aws logs tail /aws/lambda/accessagents-staging-api-scan-manager --follow

# Check Bedrock agent status
aws bedrock-agent get-agent --agent-id <agent-id>

# Destroy all resources (DANGER)
npx cdk destroy --all
```

## Security Considerations

### Production Hardening Checklist

- [ ] Enable deletion protection on Aurora cluster (`deletionProtection: true`)
- [ ] Set removal policy to RETAIN for database
- [ ] Restrict CORS origins to your domain
- [ ] Enable WAF on API Gateway
- [ ] Configure VPC flow logs
- [ ] Enable CloudTrail logging
- [ ] Use AWS KMS for encryption keys
- [ ] Implement least-privilege IAM policies
- [ ] Enable MFA for Cognito users

### Secrets Management

- Database credentials are auto-generated and stored in Secrets Manager
- Browserless API key should be stored in environment variables (not committed)
- Never commit `.env` files to source control
- Rotate credentials regularly in production

## Cleanup

Remove all deployed resources:

```bash
# Destroy specific environment
npm run destroy:staging

# Or destroy all stacks
npx cdk destroy --all
```

**Warning:** This will delete all data in Aurora and S3. Ensure you have backups before destroying production.

## Related Documentation

- [Environment Variables Reference](./environment_variables.md)
- [Infrastructure Overview](./infrastructure_overview.md)
- [Authentication Architecture](../development/authentication_architecture.md)
- [Database Schema](../requirements/database_schema.md)
- [Local Testing Guide](../testing/local_testing_guide.md)
