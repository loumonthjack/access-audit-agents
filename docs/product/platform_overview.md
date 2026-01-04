# Platform Overview

AccessAgents is an AI-powered accessibility remediation platform that autonomously detects, plans, and fixes WCAG 2.2 violations in web applications.

## Purpose

AccessAgents solves a critical problem in web development: making websites accessible to everyone, including people with disabilities. While accessibility compliance (WCAG 2.2) is both a legal requirement and ethical imperative, manual remediation is time-consuming, expensive, and requires specialized expertise that many teams lack.

This platform uses a multi-agent AI architecture to automate the entire accessibility remediation workflow - from scanning and detecting violations to intelligently fixing them and verifying the results. It transforms what typically takes weeks of manual work into an automated, reliable process.

## Key Benefits

### For Development Teams

- **Dramatic Time Savings**: What traditionally takes accessibility consultants weeks to audit and fix can be accomplished in hours. The AI agents work continuously, processing violations systematically without fatigue or context-switching overhead.

- **Reduced Expertise Barrier**: Teams no longer need deep WCAG expertise to achieve compliance. The AI understands accessibility standards and applies fixes that follow best practices, effectively embedding senior accessibility engineer knowledge into your workflow.

- **Consistent Quality**: Human auditors vary in thoroughness and interpretation. AccessAgents applies the same rigorous standards across every scan, ensuring no violations slip through due to oversight.

- **Continuous Compliance**: Integrate into your CI/CD pipeline to catch accessibility regressions before they reach production. Shift-left your accessibility testing alongside your existing quality gates.

### For Organizations

- **Cost Efficiency**: Accessibility consultants charge $150-300/hour. A single comprehensive audit can cost $10,000-50,000. AccessAgents provides unlimited scanning and remediation at a fraction of the cost.

- **Legal Risk Mitigation**: ADA lawsuits have increased 300% since 2018. Proactive accessibility compliance protects your organization from litigation, settlements, and reputational damage.

- **Market Expansion**: 15% of the global population lives with some form of disability. Accessible websites reach more customers, improve SEO rankings, and demonstrate corporate responsibility.

- **Deployment Flexibility**: Choose between self-hosted (deploy to your own AWS account) for complete data control, or use the managed SaaS platform for zero-ops convenience.

### For End Users

- **Inclusive Digital Experiences**: Screen reader users, keyboard-only navigators, and people with visual impairments gain access to websites that were previously unusable.

- **Faster Remediation Cycles**: Instead of waiting months for manual fixes, accessibility improvements ship in days, directly benefiting users who depend on assistive technologies.

## Current Features

### Single Page Scanning
Scan individual URLs for accessibility violations with real-time progress tracking:
- Enter any public URL to initiate a scan
- Choose between mobile and desktop viewport modes
- View violations categorized by impact level (critical, serious, moderate, minor)
- Real-time WebSocket updates during scanning and remediation

### AI-Powered Remediation
Automated fix generation using Amazon Bedrock agents:
- Intelligent fix planning based on violation type and context
- Specialist agents for different fix categories (alt-text, navigation, contrast)
- Automatic verification of applied fixes
- Human review flagging for complex cases

### Comprehensive Reporting
Detailed reports for every scan session:
- Summary statistics with violation counts by severity
- Before/after HTML comparisons for each fix
- Skip reasons for violations that couldn't be auto-fixed
- Export reports in JSON or HTML format

### Scan History
Track and manage all your accessibility scans:
- Paginated list of past scan sessions
- Filter by status, date, or URL
- Quick access to reports from previous scans
- Delete old sessions to manage storage

### Authentication & Authorization
Secure access with Amazon Cognito:
- Email/password authentication
- Session management with automatic token refresh
- Protected routes requiring authentication
- User-specific scan history

## How It Works

AccessAgents employs a Planner-Executor-Validator (PEV) architecture:

1. **Audit**: The Auditor agent scans your page using axe-core via Browserless.io, building a comprehensive map of WCAG violations
2. **Plan**: The Orchestrator agent (powered by Amazon Nova Pro) analyzes violations and creates a prioritized remediation strategy
3. **Execute**: Specialist fix patterns apply precise DOM modifications (attributes, content, or styles)
4. **Validate**: The Auditor re-scans fixed elements to confirm compliance before moving on
5. **Iterate**: Failed fixes trigger automatic retry with alternative strategies (up to 3 attempts)

The system includes safety guardrails to prevent breaking functionality - it will never remove interactive elements and flags complex cases for human review.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                  │
│                      Web Dashboard (React)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   REST API      │  │  WebSocket API  │  │    Cognito      │
│ (API Gateway)   │  │ (API Gateway)   │  │ (Authentication)│
└────────┬────────┘  └────────┬────────┘  └─────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Lambda Functions                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │Scan Manager │  │  WebSocket  │  │ Authorizer  │              │
│  │  (VPC)      │  │  Handler    │  │             │              │
│  └──────┬──────┘  └─────────────┘  └─────────────┘              │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Amazon Bedrock Agent                        │    │
│  │              (Amazon Nova Pro)                           │    │
│  │  ┌─────────────────┐  ┌─────────────────┐               │    │
│  │  │ Auditor Action  │  │ Injector Action │               │    │
│  │  │ (axe-core scan) │  │ (DOM fixes)     │               │    │
│  │  └─────────────────┘  └─────────────────┘               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Layer                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         Aurora PostgreSQL Serverless v2                  │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │    │
│  │  │  Users   │  │ Sessions │  │Violations│               │    │
│  │  └──────────┘  └──────────┘  └──────────┘               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Component Overview

| Component | Technology | Purpose |
|-----------|------------|---------|
| Web Dashboard | React + Vite + TanStack Router | User interface for scanning and reports |
| REST API | API Gateway + Lambda | CRUD operations for scans, sessions, reports |
| WebSocket API | API Gateway v2 | Real-time progress updates during scans |
| Scan Manager | Lambda (Node.js) | Orchestrates scan workflow, invokes Bedrock |
| Bedrock Agent | Amazon Nova Pro | AI orchestration for remediation planning |
| Auditor Lambda | Lambda + Playwright | Runs axe-core scans via Browserless.io |
| Injector Lambda | Lambda + Playwright | Applies DOM fixes via Browserless.io |
| Database | Aurora PostgreSQL Serverless v2 | Stores users, sessions, violations, fixes |
| Authentication | Amazon Cognito | User authentication and authorization |

## Deployment Options

AccessAgents supports two deployment modes to fit different organizational needs:

### Self-Hosted (Community Edition)

Deploy to your own AWS account using AWS CDK for complete control over your data and infrastructure.

| Aspect | Details |
|--------|---------|
| **Deployment** | Your AWS account via CDK |
| **Data Control** | Full ownership - data never leaves your account |
| **Cost Model** | Pay only AWS usage costs (Aurora, Lambda, Bedrock) |
| **Maintenance** | Self-managed updates and monitoring |
| **Best For** | Teams with strict data residency requirements, existing AWS infrastructure |

**Estimated Monthly Costs (Self-Hosted)**:
| Usage Tier | Scans/Month | Estimated Cost |
|------------|-------------|----------------|
| Light | 100 | $50-100 |
| Medium | 1,000 | $200-400 |
| Heavy | 10,000 | $1,000-2,000 |

*Costs vary based on page complexity, violation count, and AWS region.*

### Managed SaaS (Enterprise Edition)

Zero-ops managed platform with additional enterprise features.

| Aspect | Details |
|--------|---------|
| **Deployment** | Multi-tenant managed platform |
| **Data Control** | Encrypted at rest and in transit, SOC 2 compliant |
| **Cost Model** | Subscription pricing with usage tiers |
| **Maintenance** | Fully managed - automatic updates and scaling |
| **Best For** | Teams wanting zero infrastructure overhead |

**Enterprise Features**:
- Single Sign-On (SSO) integration
- Team collaboration and shared workspaces
- Priority support and SLAs
- Custom integrations and API access
- Advanced analytics and trending

### Feature Comparison

| Feature | Self-Hosted | SaaS |
|---------|-------------|------|
| Single page scanning | ✅ | ✅ |
| AI-powered remediation | ✅ | ✅ |
| Report generation | ✅ | ✅ |
| Scan history | ✅ | ✅ |
| JSON/HTML export | ✅ | ✅ |
| WebSocket progress | ✅ | ✅ |
| SSO integration | ❌ | ✅ |
| Team workspaces | ❌ | ✅ |
| Priority support | Community | ✅ |
| Automatic updates | Manual | ✅ |
| Sitemap scanning | 🔜 Planned | 🔜 Planned |

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TanStack Router, TanStack Query, Tailwind CSS |
| **API** | Amazon API Gateway (REST + WebSocket), AWS Lambda (Node.js 20) |
| **AI Orchestration** | Amazon Bedrock Agents (Amazon Nova Pro) |
| **Browser Automation** | Playwright, Browserless.io |
| **Accessibility Testing** | axe-core, @axe-core/playwright |
| **Database** | Amazon Aurora PostgreSQL Serverless v2 |
| **Authentication** | Amazon Cognito, AWS Amplify |
| **Infrastructure** | AWS CDK (TypeScript) |
| **Testing** | Vitest, Playwright, fast-check (property-based) |

## Project Structure

```
/access-agents-monorepo
├── /apps
│   ├── /web                    # React Dashboard (Vite + TanStack)
│   └── /api                    # Local development API server
├── /packages
│   └── /core
│       └── /agents
│           ├── /auditor        # Auditor agent logic
│           └── /orchestrator   # Orchestration logic
├── /infra                      # AWS CDK infrastructure
│   ├── /lib
│   │   ├── /stacks            # CDK stack definitions
│   │   ├── /lambdas           # Lambda function handlers
│   │   └── /config            # Environment configurations
│   ├── /migrations            # Database migrations
│   └── /schemas               # OpenAPI schemas for Bedrock
└── /docs                       # Documentation
    ├── /engineering           # Technical documentation
    ├── /product               # Product documentation
    └── /support               # User support documentation
```

## Getting Started

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- AWS CLI (for deployment)
- pnpm (recommended) or npm

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-org/access-agents.git
cd access-agents

# Install dependencies
pnpm install

# Start local services (PostgreSQL)
docker-compose up -d

# Run database migrations
pnpm --filter api db:migrate

# Start development servers
pnpm dev
```

### AWS Deployment

See the [CDK Deployment Guide](../engineering/deployment/cdk_deployment_guide.md) for detailed deployment instructions.

## Roadmap

### Planned Features

- **Sitemap Scanning**: Batch scan entire websites by providing a sitemap URL
- **CI/CD Integration**: GitHub Actions and GitLab CI plugins
- **Scheduled Scans**: Automated recurring accessibility audits
- **Trend Analysis**: Track accessibility improvements over time
- **Custom Rules**: Define organization-specific accessibility requirements

See the [Product Roadmap](./roadmap.md) for detailed timeline and priorities.

## License

- Core packages (`/packages/core`): MIT License
- Infrastructure code (`/infra`): MIT License
- Enterprise features: Proprietary (SaaS only)
