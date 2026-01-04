# AccessAgents

> AI-powered accessibility remediation at scale. Built in days, not months.

**AccessAgents** is a platform that autonomously detects, plans, and fixes WCAG 2.2 violations in web applications using a multi-agent AI architecture powered by Amazon Bedrock.

This entire platform—frontend, backend, infrastructure, and AI orchestration—was built rapidly using [Kiro](https://kiro.dev), Claude Code, and Opus 4.5.

---

## What It Does

1. **Scan** any URL for accessibility violations using axe-core
2. **Plan** remediation strategies with Amazon Nova Pro
3. **Fix** DOM issues automatically via specialist AI agents
4. **Verify** fixes pass re-validation before moving on
5. **Report** comprehensive before/after comparisons

The system handles the entire accessibility remediation workflow—from detection to fix to verification—without human intervention for most violation types.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React + Vite + TanStack                       │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         REST API       WebSocket API      Cognito
              │               │
              └───────┬───────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Lambda (Node.js 20)                       │
│         Scan Manager │ Batch Orchestrator │ WebSocket            │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Amazon Bedrock Agent (Nova Pro)                     │
│              Auditor Action │ Injector Action                    │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Aurora PostgreSQL Serverless v2                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18, Vite, TanStack Router/Query, Tailwind |
| API | API Gateway (REST + WebSocket), Lambda |
| AI | Amazon Bedrock Agents, Nova Pro |
| Browser | Playwright, Browserless.io, axe-core |
| Database | Aurora PostgreSQL Serverless v2 |
| Auth | Amazon Cognito |
| IaC | AWS CDK (TypeScript) |
| Testing | Vitest, Playwright, fast-check |

---

## Local Development

```bash
# Start PostgreSQL + Browserless
docker-compose up -d

# API (Terminal 1)
cd apps/api && npm install && npm run dev

# Frontend (Terminal 2)
cd apps/web && npm install && npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3003
- Database: localhost:5434

### Environment Setup

**API** (`apps/api/.env`):
```env
PORT=3003
DATABASE_URL=postgresql://postgres:localdev123@localhost:5432/accessagents
JWT_SECRET=local-dev-secret
AWS_REGION=us-east-1
# Optional: Add BEDROCK_AGENT_ID and BEDROCK_AGENT_ALIAS_ID for real AI scanning
```

**Frontend** (`apps/web/.env.local`):
```env
VITE_API_URL=http://localhost:3003/api
VITE_WS_URL=ws://localhost:3003/ws
VITE_AUTH_MODE=self-hosted
VITE_ENABLE_MSW=false
```

Without Bedrock credentials, the API runs in simulation mode with mock results.

---

## Production Deployment

Deploy to your AWS account using CDK:

```bash
cd infra
npm install
npm run deploy:prod
```

### Cost Estimates

| Environment | Monthly Cost |
|-------------|--------------|
| Development | $15-50 |
| Staging | $50-150 |
| Production | $200-800 |

Aurora Serverless v2 scales to zero in dev/staging. Production uses NAT gateways and higher capacity.

See [CDK Deployment Guide](docs/engineering/deployment/cdk_deployment_guide.md) for full instructions.

### Production Requirements

To run AccessAgents in production, you'll need:

| Requirement | Purpose |
|-------------|---------|
| AWS Account | Host all infrastructure (Lambda, Aurora, API Gateway, Cognito) |
| Amazon Bedrock Access | Enable Nova Pro model in your region for AI remediation |
| Browserless.io API Key | Headless Chrome for scanning (see tiers below) |
| Custom Domain (optional) | Route53 + ACM certificate for branded URLs |
| CI/CD Pipeline (optional) | GitHub Actions or CodePipeline for automated deployments |

**AWS Services Used:**
- Lambda (Node.js 20) — compute
- API Gateway (REST + WebSocket) — APIs
- Aurora PostgreSQL Serverless v2 — database
- Cognito — authentication
- Bedrock — AI agents
- S3 — report storage
- Secrets Manager — credentials
- CloudWatch — monitoring

**Browserless.io Tiers:**

| Tier | Browser Units | Concurrent Sessions | Best For |
|------|---------------|---------------------|----------|
| Free | 1,000/month | 1 | Local dev, testing |
| Starter ($50/mo) | 10,000/month | 5 | Small teams, light usage |
| Pro ($200/mo) | 50,000/month | 25 | Production workloads |
| Scale ($500/mo) | 200,000/month | 100 | High-volume scanning |
| Enterprise | Custom | Custom | Self-hosted or dedicated |

*1 browser unit ≈ 1 page scan. Batch scans consume units per page. Self-hosting Browserless is an option for unlimited usage.*

---

## Project Structure

```
├── apps/
│   ├── web/          # React dashboard
│   └── api/          # Local dev API server
├── packages/
│   └── core/agents/  # Auditor + Orchestrator logic
├── infra/            # AWS CDK stacks + Lambda handlers
└── docs/             # Engineering, product, support docs
```

---

## How It Was Built

This project demonstrates what's possible when you combine modern AI coding assistants with a clear architectural vision:

- **Kiro** for spec-driven development and structured feature planning
- **Claude Code** for rapid implementation and debugging
- **Opus 4.5** for complex reasoning and architecture decisions

The result: a fully functional, **almost** production-ready accessibility platform with real-time WebSocket updates, AI-powered remediation, comprehensive testing, and enterprise-grade AWS infrastructure—built at startup speed with enterprise quality.

---

## Roadmap

| Feature | Status |
|---------|--------|
| Single page scanning | ✅ Shipped |
| AI-powered remediation | ✅ Shipped |
| Real-time WebSocket progress | ✅ Shipped |
| Scan history & reports | ✅ Shipped |
| Batch/sitemap scanning | ✅ Shipped |
| CI/CD integration (GitHub Actions) | 🔜 Planned |
| Scheduled recurring scans | 🔜 Planned |
| Trend analysis & dashboards | 🔜 Planned |
| Custom rule definitions | 🔜 Planned |
| SSO / team workspaces (SaaS) | 🔜 Planned |

---

## License

MIT License for core packages and infrastructure code.

---

## Testing

### Postman Collections

Import the Postman collections from `docs/engineering/testing/collections/` to test the API:

| Collection | Endpoints |
|------------|-----------|
| Auth | Login, logout, user profile |
| Scans | Start scan, get status, get violations |
| Sessions | List sessions, delete session |
| Reports | Get report, export JSON/HTML |
| BatchScans | Sitemap parsing, batch operations, batch reports |

**Quick start:**
1. Import all `.json` files from `docs/engineering/testing/collections/`
2. Select "AccessAgents - Local Development" environment
3. Run "Login" first to authenticate
4. Run other requests as needed

See [Postman Collections README](docs/engineering/testing/collections/README.md) for detailed workflows.

### Running Tests

```bash
# Frontend unit tests
cd apps/web && npm run test

# E2E tests
cd apps/web && npx playwright test

# Backend tests
cd packages/core/agents/auditor && npm run test
```

---

## Documentation

- [Platform Overview](docs/product/platform_overview.md)
- [Local Setup Guide](docs/engineering/development/local_setup.md)
- [Infrastructure Overview](docs/engineering/deployment/infrastructure_overview.md)
- [API Reference](docs/engineering/development/api_reference.md)
- [Testing Strategy](docs/engineering/testing/testing_strategy.md)
- [Postman Collections](docs/engineering/testing/collections/README.md)
