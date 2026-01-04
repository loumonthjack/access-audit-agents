# AccessAgents Infrastructure

AWS CDK infrastructure for deploying AccessAgents to your AWS account.

## Architecture

The infrastructure consists of four CDK stacks:

| Stack | Description | Resources |
|-------|-------------|-----------|
| **Auth Stack** | User authentication | Cognito User Pool, App Client, Identity Pool |
| **Database Stack** | Data persistence | Aurora PostgreSQL Serverless v2, VPC, Secrets Manager |
| **API Stack** | REST and WebSocket APIs | API Gateway, Lambda functions |
| **Bedrock Stack** | AI orchestration | Bedrock Agent, Action Groups |

## Environment Configuration

AccessAgents uses `NODE_ENV` to manage environment-specific configurations:

| Environment | Aurora ACU | NAT Gateways | Use Case |
|-------------|-----------|--------------|----------|
| **development** | 0-2 (scales to 0) | 0 | Local dev with Docker PostgreSQL |
| **staging** | 0-4 (scales to 0) | 0 | Cost-optimized testing |
| **production** | 0.5-16 (always warm) | 2 | High availability |

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **Node.js** 18+ and npm
4. **Docker** (for local development and Lambda bundling)
5. **Browserless.io** account (for accessibility scanning)

## Quick Start

### Option A: Local Development (Recommended for Testing)

Use Docker for PostgreSQL, only connect to AWS Bedrock for AI features:

```bash
# Start local PostgreSQL
cd /path/to/ai-accessibility-agent
docker-compose up -d

# Start frontend with mocking
cd apps/web
npm run dev
```

### Option B: Deploy to AWS

#### 1. Install Dependencies

```bash
cd infra
npm install
```

#### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set:
- `NODE_ENV` - Environment (`development`, `staging`, or `production`)
- `CDK_DEFAULT_ACCOUNT` - Your AWS account ID (12-digit number)
- `CDK_DEFAULT_REGION` - AWS region (e.g., `us-east-1`)
- `BROWSERLESS_API_KEY` - Get from [browserless.io](https://browserless.io)

#### 3. Configure AWS Credentials

Option A - AWS CLI (recommended):
```bash
aws configure
```

Option B - Environment variables (CI/CD):
```bash
export AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
export AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
```

Verify credentials work:
```bash
aws sts get-caller-identity
```

#### 4. Bootstrap CDK (first time only)

```bash
source .env  # Load environment variables
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION
```

#### 5. Deploy All Stacks

```bash
# Development environment (lowest cost)
npm run deploy:dev

# Staging environment
npm run deploy:staging

# Production environment
npm run deploy:prod
```

Or deploy with explicit NODE_ENV:

```bash
NODE_ENV=staging npx cdk deploy --all
```

### 6. Get Stack Outputs

After deployment, note the outputs:

```bash
npx cdk outputs
```

Key outputs:
- `UserPoolId` - Cognito User Pool ID
- `UserPoolClientId` - Cognito App Client ID
- `ApiEndpoint` - REST API URL
- `WebSocketEndpoint` - WebSocket API URL

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

## Project Structure

```
infra/
├── bin/
│   └── app.ts                    # CDK app entry point
├── lib/
│   ├── config/
│   │   └── environments.ts       # Environment configurations
│   ├── stacks/
│   │   ├── auth-stack.ts         # Cognito User Pool
│   │   ├── database-stack.ts     # Aurora PostgreSQL
│   │   ├── api-stack.ts          # API Gateway + Lambdas
│   │   └── bedrock-stack.ts      # Bedrock Agent
│   └── lambdas/
│       ├── scan-manager/         # Main orchestration Lambda
│       ├── websocket/            # WebSocket handler
│       ├── authorizer/           # JWT validation
│       ├── auditor/              # Axe-core scanner
│       └── injector/             # DOM manipulation
├── migrations/
│   └── 001_initial_schema.sql    # Database schema
├── schemas/
│   ├── auditor-openapi.yaml      # Auditor action group schema
│   └── injector-openapi.yaml     # Injector action group schema
├── cdk.json
├── package.json
└── tsconfig.json
```

## Post-Deployment Setup

### 1. Run Database Migration

After deploying, run the initial schema migration:

```bash
# Get database credentials
aws secretsmanager get-secret-value \
  --secret-id accessagents-staging-database/db-credentials \
  --query SecretString --output text | jq .

# Get cluster endpoint from stack outputs
npx cdk outputs accessagents-staging-database

# Connect via bastion/Session Manager and run migration
psql -h <cluster-endpoint> -U postgres -d accessagents \
  -f migrations/001_initial_schema.sql
```

### 2. Configure Frontend

Copy CDK outputs to the web app environment:

```bash
# Get all outputs
npx cdk outputs --all

# Configure frontend
cd ../apps/web
cp .env.example .env.local
```

Edit `apps/web/.env.local` with deployed values:

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

### 3. Test the Deployment

```bash
cd apps/web
npm run dev
# Open http://localhost:5173
# Sign up, login, and start a scan
```

## Costs by Environment

### Development (Local)

| Service | Cost |
|---------|------|
| Docker PostgreSQL | $0 |
| AWS Bedrock | Pay per token (~$0.003/1K input) |
| **Total** | **~$0-5/month** |

### Staging (AWS)

| Service | Estimated Cost |
|---------|---------------|
| Aurora Serverless v2 (0 ACU min) | $0 when idle |
| Lambda | Pay per invocation |
| API Gateway | Pay per request |
| Cognito | Free tier |
| **Total** | **~$5-20/month** |

### Production (AWS)

| Service | Estimated Cost |
|---------|---------------|
| Aurora Serverless v2 (0.5 ACU min) | ~$45/month |
| NAT Gateway (2x) | ~$70/month |
| Lambda | Pay per invocation |
| API Gateway | Pay per request |
| Cognito | Free tier (50K MAU) |
| Bedrock (Claude 3.5) | Pay per token |
| **Total** | **~$120+/month** |

## Cleanup

Remove all deployed resources:

```bash
# Destroy specific environment
npm run destroy:staging

# Or destroy all
npm run destroy
```

**Warning**: This will delete all data in Aurora and S3.

## Troubleshooting

### Docker Not Running

CDK Lambda bundling requires Docker. Start Docker Desktop or:
```bash
docker-compose up -d
```

### CDK Bootstrap Failed

Ensure your AWS credentials have `AdministratorAccess` or equivalent permissions.

### Lambda VPC Timeout

If Lambdas in VPC can't reach the internet:
1. Verify NAT Gateway is deployed (`NODE_ENV=production`)
2. Check security group rules
3. Verify route tables

### Bedrock Agent Not Responding

1. Verify the agent alias is in "Prepared" state
2. Check Lambda permissions for Bedrock invocation
3. Review CloudWatch logs for the ScanManager Lambda

## Contributing

See the main repository [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
