# Infrastructure Overview

This document describes the production infrastructure components for the AccessAgents platform, including architecture diagrams, cost estimates, and monitoring setup.

## Overview

AccessAgents is deployed on AWS using a serverless architecture. The infrastructure is defined as code using AWS CDK and supports three deployment modes:

| Mode | Use Case | Infrastructure |
|------|----------|----------------|
| Local Development | Testing and development | Docker PostgreSQL + AWS Bedrock |
| Self-Hosted | On-premises deployment | Full AWS stack in customer account |
| SaaS | Managed service | Multi-tenant AWS deployment |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                 CLIENTS                                      │
│           Web Dashboard (React + Vite + TanStack Query)                     │
│                   Hosted on AWS Amplify / Vercel                            │
└─────────────────────────────────────────────────────────────────────────────┘
                      │                           │
                      │ HTTPS (REST)              │ WSS (WebSocket)
                      ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY LAYER                                   │
│  ┌───────────────────────────┐    ┌───────────────────────────────┐         │
│  │      REST API Gateway     │    │     WebSocket API Gateway     │         │
│  │  • Cognito Authorizer     │    │   • Lambda Authorizer         │         │
│  │  • POST /scans            │    │   • $connect                  │         │
│  │  • GET /scans/{id}        │    │   • $disconnect               │         │
│  │  • GET /sessions          │    │   • $default                  │         │
│  │  • GET /reports/{id}      │    │                               │         │
│  │  • GET /health            │    │   Batch Events:               │         │
│  │                           │    │   • batch:started             │         │
│  │  Batch Endpoints:         │    │   • batch:page_complete       │         │
│  │  • POST /sitemaps/parse   │    │   • batch:page_failed         │         │
│  │  • POST /batch-scans      │    │   • batch:paused/resumed      │         │
│  │  • GET /batch-scans/{id}  │    │   • batch:completed           │         │
│  │  • POST /batch-scans/     │    │                               │         │
│  │    {id}/pause|resume|     │    │                               │         │
│  │    cancel                 │    │                               │         │
│  │  • GET /batch-scans/      │    │                               │         │
│  │    {id}/report            │    │                               │         │
│  └───────────────────────────┘    └───────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                      │                           │
                      ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPUTE LAYER (Lambda)                                │
│                                                                              │
│  VPC (Private Subnets):                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐                  │
│  │ Scan Manager  │  │  WebSocket    │  │Migration Runner │                  │
│  │ 512-2048 MB   │  │  256 MB       │  │ 256 MB          │                  │
│  └───────────────┘  └───────────────┘  └─────────────────┘                  │
│  ┌───────────────────────────┐  ┌───────────────────────────┐               │
│  │   Batch Orchestrator      │  │    Sitemap Parser         │               │
│  │   512-2048 MB             │  │    256 MB                 │               │
│  │   • Sequential processing │  │    • XML parsing          │               │
│  │   • Pause/resume/cancel   │  │    • Recursive sitemap    │               │
│  │   • Report generation     │  │    • Domain validation    │               │
│  └───────────────────────────┘  └───────────────────────────┘               │
│                                                                              │
│  Outside VPC (Internet Access):                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐                  │
│  │   Auditor     │  │   Injector    │  │   Authorizer    │                  │
│  │   2048 MB     │  │   1024 MB     │  │   128 MB        │                  │
│  └───────────────┘  └───────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL: Browserless.io                               │
│                Headless Chrome for Accessibility Scanning                    │
└─────────────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI LAYER (Amazon Bedrock)                             │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                Orchestrator Agent (Amazon Nova Pro)              │        │
│  │  ┌────────────────────┐  ┌────────────────────┐                 │        │
│  │  │  Auditor Action    │  │  Injector Action   │                 │        │
│  │  │  Group             │  │  Group             │                 │        │
│  │  └────────────────────┘  └────────────────────┘                 │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐          │
│  │Aurora PostgreSQL│  │   Amazon S3     │  │  Secrets Manager    │          │
│  │ Serverless v2   │  │   (Reports)     │  │  (DB Credentials)   │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘          │
│  ┌─────────────────┐  ┌─────────────────────────────────────────┐           │
│  │SSM Parameters   │  │          VPC Endpoints                  │           │
│  │(Bedrock IDs)    │  │  (When NAT Gateways = 0)                │           │
│  └─────────────────┘  └─────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATION LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                  Amazon Cognito User Pool                        │        │
│  │  • Email-based sign-up    • Access Token: 1 hour                │        │
│  │  • Auto verification      • Refresh Token: 30 days              │        │
│  │  • OAuth 2.0 / OIDC       • Hosted UI                           │        │
│  └─────────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Summary

### Frontend Layer

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web Dashboard | React 18 + Vite | Single-page application |
| State Management | TanStack Query | Server state caching |
| Routing | TanStack Router | Type-safe routing |
| UI Components | Tailwind CSS | Styling |
| Hosting | AWS Amplify / Vercel | Static site hosting with CI/CD |

### API Layer

| Component | Service | Purpose |
|-----------|---------|---------|
| REST API | API Gateway REST | CRUD operations |
| WebSocket API | API Gateway WebSocket | Real-time updates |
| Authorization | Cognito Authorizer | JWT validation |
| Rate Limiting | API Gateway Throttling | 10-50 req/sec |

### Compute Layer

| Lambda | Memory | Timeout | VPC | Purpose |
|--------|--------|---------|-----|---------|
| Scan Manager | 512-2048 MB | 2.5-25 min | Yes | Orchestration |
| Auditor | 2048 MB | 60s+ | No | Axe-core scanning |
| Injector | 1024 MB | 60s+ | No | DOM fixes |
| WebSocket | 256 MB | 30s | Yes | Real-time |
| Authorizer | 128 MB | 10s | No | JWT validation |
| Migration Runner | 256 MB | 5 min | Yes | DB migrations |
| Batch Orchestrator | 512-2048 MB | 25 min | Yes | Batch scan processing |
| Sitemap Parser | 256 MB | 30s | No | Sitemap XML parsing |

### AI Layer

| Component | Service | Purpose |
|-----------|---------|---------|
| Orchestrator Agent | Amazon Bedrock | AI remediation |
| Foundation Model | Amazon Nova Pro v1 | NLU |
| Action Groups | Bedrock Actions | Tool execution |

### Data Layer

| Component | Service | Purpose |
|-----------|---------|---------|
| Database | Aurora PostgreSQL Serverless v2 | Data storage |
| Object Storage | Amazon S3 | Reports export |
| Secrets | AWS Secrets Manager | Credentials |
| Parameters | SSM Parameter Store | Bedrock IDs |

### Authentication Layer

| Component | Service | Purpose |
|-----------|---------|---------|
| User Pool | Amazon Cognito | Authentication |
| Identity Pool | Amazon Cognito | IAM for S3 |
| Hosted UI | Cognito Domain | Sign-up/sign-in |



## Cost Estimation

### Environment Configurations

AccessAgents supports three environment tiers with different cost profiles:

| Configuration | Development | Staging | Production |
|---------------|-------------|---------|------------|
| Aurora Min ACU | 0 (scales to zero) | 0 (scales to zero) | 0.5 |
| Aurora Max ACU | 2 | 4 | 16 |
| NAT Gateways | 0 | 0 | 2 |
| Availability Zones | 2 | 2 | 3 |
| Lambda Memory | 512 MB | 1024 MB | 2048 MB |
| Lambda Timeout | 30s | 60s | 300s |
| Log Retention | 3 days | 14 days | 90 days |
| Backup Retention | 1 day | 7 days | 30 days |
| Deletion Protection | No | No | Yes |

### Monthly Cost Estimates by Tier

#### Development Environment (~$15-50/month)

| Service | Usage Assumption | Estimated Cost |
|---------|------------------|----------------|
| Aurora Serverless v2 | 0-2 ACU, scales to zero | $0-30 |
| API Gateway | 100K requests | $0.35 |
| Lambda | 10K invocations | $0.20 |
| CloudWatch Logs | 1 GB | $0.50 |
| Secrets Manager | 2 secrets | $0.80 |
| Cognito | 50 MAU | Free tier |
| **Total** | | **~$15-50** |

#### Staging Environment (~$50-150/month)

| Service | Usage Assumption | Estimated Cost |
|---------|------------------|----------------|
| Aurora Serverless v2 | 0-4 ACU, moderate usage | $20-80 |
| API Gateway | 500K requests | $1.75 |
| Lambda | 50K invocations | $1.00 |
| CloudWatch Logs | 5 GB | $2.50 |
| Secrets Manager | 2 secrets | $0.80 |
| Cognito | 200 MAU | Free tier |
| S3 | 10 GB storage | $0.23 |
| **Total** | | **~$50-150** |

#### Production Environment (~$200-800/month)

| Service | Usage Assumption | Estimated Cost |
|---------|------------------|----------------|
| Aurora Serverless v2 | 0.5-16 ACU, high usage | $100-400 |
| NAT Gateway | 2 gateways, 100 GB data | $90 |
| API Gateway | 2M requests | $7.00 |
| Lambda | 500K invocations | $10.00 |
| CloudWatch Logs | 50 GB | $25.00 |
| Secrets Manager | 5 secrets | $2.00 |
| Cognito | 1000 MAU | Free tier |
| S3 | 100 GB storage | $2.30 |
| Bedrock | 1M tokens | $15.00 |
| **Total** | | **~$200-800** |

### Cost Optimization Tips

1. **Aurora Serverless v2**: Set `minCapacity: 0` for non-production to scale to zero during idle periods
2. **NAT Gateways**: Use VPC endpoints instead of NAT gateways in development/staging (saves ~$90/month)
3. **Lambda**: Right-size memory allocation based on actual usage patterns
4. **CloudWatch Logs**: Reduce retention period for non-production environments
5. **Reserved Capacity**: Consider Aurora Reserved Instances for predictable production workloads

### VPC Endpoints (NAT Gateway Alternative)

When `natGateways: 0`, the following VPC endpoints are automatically created:

| Endpoint | Purpose |
|----------|---------|
| Secrets Manager | Database credential access |
| SSM | Bedrock Agent ID retrieval |
| Bedrock Runtime | AI model invocation |
| Bedrock Agent Runtime | Agent invocation |
| API Gateway | WebSocket management |
| Lambda | Cross-Lambda invocation |

This configuration eliminates NAT Gateway costs (~$90/month) while maintaining full functionality.

## Monitoring and Alerting Setup

### CloudWatch Dashboards

Create a CloudWatch dashboard for real-time monitoring:

```bash
# Dashboard components to include:
# 1. Lambda metrics (invocations, errors, duration)
# 2. API Gateway metrics (requests, latency, 4xx/5xx errors)
# 3. Aurora metrics (connections, CPU, storage)
# 4. WebSocket connections
# 5. Batch scan progress
```

#### Recommended Dashboard Widgets

| Widget | Metrics | Purpose |
|--------|---------|---------|
| Lambda Invocations | Sum of invocations per function | Track usage patterns |
| Lambda Errors | Sum of errors per function | Identify failing functions |
| Lambda Duration | Average/P99 duration | Performance monitoring |
| API Gateway Requests | Count by endpoint | Traffic analysis |
| API Gateway Latency | P50/P90/P99 latency | Performance SLAs |
| API Gateway Errors | 4xx and 5xx counts | Error tracking |
| Aurora Connections | Active connections | Database load |
| Aurora CPU | CPU utilization | Capacity planning |
| Aurora Storage | Storage used | Growth tracking |
| Batch Scans | Active/completed/failed | Feature usage |

### CloudWatch Alarms

Configure the following alarms for production:

#### Critical Alarms (PagerDuty/SNS)

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| High Lambda Errors | Errors > 10 in 5 min | Critical | Page on-call |
| API Gateway 5xx | 5xx > 1% of requests | Critical | Page on-call |
| Aurora High CPU | CPU > 90% for 5 min | Critical | Page on-call |
| Aurora Storage Full | Storage > 90% | Critical | Page on-call |
| Scan Manager Timeout | Duration > 20 min | Warning | Notify team |

#### Warning Alarms (Email/Slack)

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| Lambda Throttling | Throttles > 0 | Warning | Notify team |
| API Gateway 4xx | 4xx > 5% of requests | Warning | Notify team |
| Aurora Connections | Connections > 80% max | Warning | Notify team |
| High Latency | P99 > 5s | Warning | Notify team |
| Batch Failures | Failed batches > 10% | Warning | Notify team |

### Setting Up Alarms via CDK

```typescript
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';

// Create SNS topic for alerts
const alertTopic = new sns.Topic(this, 'AlertTopic', {
  topicName: 'accessagents-alerts',
});

// Lambda error alarm
new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
  metric: scanManagerLambda.metricErrors(),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'High Lambda error rate',
  actionsEnabled: true,
});

// API Gateway 5xx alarm
new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
  metric: restApi.metricServerError(),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'High API Gateway 5xx rate',
});

// Aurora CPU alarm
new cloudwatch.Alarm(this, 'AuroraCpuAlarm', {
  metric: cluster.metricCPUUtilization(),
  threshold: 90,
  evaluationPeriods: 3,
  alarmDescription: 'Aurora CPU utilization high',
});
```

### Log Insights Queries

Useful CloudWatch Logs Insights queries for troubleshooting:

#### Find Lambda Errors

```sql
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

#### Scan Duration Analysis

```sql
fields @timestamp, @duration, @billedDuration
| filter @type = "REPORT"
| stats avg(@duration), max(@duration), p99(@duration) by bin(1h)
```

#### API Gateway Latency

```sql
fields @timestamp, @message
| filter @message like /latency/
| parse @message "latency: *ms" as latency
| stats avg(latency), p99(latency) by bin(5m)
```

#### Batch Scan Progress

```sql
fields @timestamp, @message
| filter @message like /batch/
| parse @message "Batch * status: *" as batchId, status
| stats count() by status
```

### X-Ray Tracing

Enable X-Ray tracing for distributed request tracking:

```typescript
// Enable X-Ray in Lambda
const scanManagerLambda = new lambdaNodejs.NodejsFunction(this, 'ScanManager', {
  tracing: lambda.Tracing.ACTIVE,
  // ... other config
});

// Enable X-Ray in API Gateway
const restApi = new apigateway.RestApi(this, 'RestApi', {
  deployOptions: {
    tracingEnabled: true,
  },
});
```

### Health Check Endpoints

The platform exposes health check endpoints for monitoring:

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | None | API Gateway health |
| `/health/db` | GET | Required | Database connectivity |
| `/health/bedrock` | GET | Required | Bedrock agent status |

### Recommended Monitoring Tools

| Tool | Purpose | Integration |
|------|---------|-------------|
| CloudWatch | Native AWS monitoring | Built-in |
| X-Ray | Distributed tracing | CDK enabled |
| Datadog | APM and dashboards | Lambda layer |
| PagerDuty | Incident management | SNS integration |
| Slack | Team notifications | SNS/Lambda |

### Alerting Best Practices

1. **Severity Levels**: Define clear severity levels (Critical, Warning, Info)
2. **Runbooks**: Create runbooks for each critical alarm
3. **Escalation**: Set up escalation policies for unacknowledged alerts
4. **Noise Reduction**: Tune thresholds to avoid alert fatigue
5. **Testing**: Regularly test alerting pipelines
6. **Documentation**: Document all alarms and their remediation steps

### Sample SNS Alert Configuration

```typescript
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

// Create topics for different severity levels
const criticalTopic = new sns.Topic(this, 'CriticalAlerts');
const warningTopic = new sns.Topic(this, 'WarningAlerts');

// Add email subscriptions
criticalTopic.addSubscription(
  new subscriptions.EmailSubscription('oncall@example.com')
);

// Add Slack webhook (via Lambda)
warningTopic.addSubscription(
  new subscriptions.LambdaSubscription(slackNotifierLambda)
);
```
