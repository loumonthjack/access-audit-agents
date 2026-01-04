# Technical Design Document: AccessAgents Platform

**Version:** 1.1.0 (AWS Serverless Revision)  
**Status:** Draft  
**Target Audience:** Engineering Leads, Product Managers, DevOps

---

## 1. Executive Summary

AccessAgents is a hybrid AI-powered accessibility remediation platform. It utilizes a Planner-Executor-Validator agent architecture to autonomously detect, plan, and fix WCAG 2.1 violations in web applications.

The platform follows an **Open Core** business model:

- **Community Edition (CE):** "Customer-Cloud" deployment. Users deploy the full stack to their own AWS account using CDK/Terraform.
- **Enterprise Edition (EE):** Hosted SaaS, multi-tenant, managed infrastructure, SSO, and team collaboration features.

---

## 2. System Architecture

### 2.1 The Cloud-Native Architecture

The system is fully serverless, relying on AWS managed services to handle scale, auth, and AI orchestration.

- **Frontend:** React (SPA) hosted on AWS Amplify (S3 + CloudFront).
- **API Layer:** Amazon API Gateway (REST/WebSocket) routing requests to AWS Lambda.
- **AI Runtime:** Amazon Bedrock Agents (AgentCore Runtime).

#### The Request Flow

1. **Client:** User initiates a scan via the React Dashboard (Amplify).
2. **Gateway:** API Gateway authenticates the request via Amazon Cognito and triggers the ScanManager Lambda.
3. **Orchestration:** The Lambda invokes the Amazon Bedrock Agent.
4. **Agent Workflow (Bedrock):**
   - **Auditor Action Group:** Triggers a Lambda that spins up a headless browser (Playwright on AWS Lambda Web Adapter or Fargate) to run axe-core.
   - **Planner (Claude 3.5 Sonnet):** Bedrock analyzes the audit JSON and creates a remediation plan.
   - **Specialist Agents:** Bedrock recursively calls specialized Action Groups (Lambda functions) for Alt-Text and ARIA fixes.
5. **Storage:** Results and plans are stored in Amazon Aurora PostgreSQL (Serverless v2).

### 2.2 The "Open Core" Mechanism

We utilize a Monorepo strategy with AWS CDK to manage deployments.

- **Shared Core (`/stacks/core`):** Contains the Bedrock Agent definitions (Prompt templates, OpenAPI schemas) and standard Lambda functions.
- **SaaS Extensions (`/stacks/enterprise`):** Contains the Multi-tenant Cognito configuration, Stripe Webhook Lambdas, and usage metering logic.

---

## 3. Technology Stack

| Layer            | Technology                   | Justification                                                        |
|------------------|------------------------------|----------------------------------------------------------------------|
| Frontend         | React + AWS Amplify          | Fully managed CI/CD, hosting, and CDN (CloudFront).                  |
| API              | API Gateway + Lambda         | Serverless scale-to-zero; pay only per invocation.                   |
| Auth             | Amazon Cognito               | Native integration with API Gateway and Amplify.                     |
| AI Orchestration | Amazon Bedrock Agents        | Managed agent runtime with built-in state management and trace.      |
| AI Models        | Bedrock (Claude 3.5 Sonnet)  | Best-in-class reasoning for code generation.                         |
| Database         | Amazon Aurora Serverless v2  | PostgreSQL compatibility with auto-scaling storage and compute.      |
| Storage          | Amazon S3                    | Storing HTML snapshots, reports, and frontend assets.                |

---

## 4. Data & Security Strategy

### 4.1 Data Isolation (SaaS)

- **Cognito Groups:** Users are assigned to groups (Organization IDs).
- **API Guardrails:** A generic Lambda Authorizer extracts the `org_id` from the JWT and injects it into the DB query context.
- **Database:** Aurora Row-Level Security (RLS) is configured to respect the `org_id`.

### 4.2 The "Sanitized Injector" Action Group

To prevent the AI from breaking the site or injecting XSS, the Bedrock Agent does not have direct DOM access.

1. **Instruction Generation:** The Bedrock Agent calls the `GenerateFix` tool.
2. **Output:** Returns a JSON instruction:
   ```json
   { "selector": "#btn", "aria-label": "Close" }
   ```
3. **Validation Lambda:** A separate Lambda validates this JSON against a strict schema (Zod) before saving it to the database as a "Pending Fix."

---

## 5. Deployment Infrastructure

### 5.1 Self-Hosted (Customer Cloud)

- **Concept:** Since Bedrock cannot run locally, "Self-Hosted" means "Deploy to your own AWS".
- **Mechanism:** Users run `npx cdk deploy`.
  - Creates a private S3 bucket.
  - Deploys the Bedrock Agent to their account.
  - Sets up a private Cognito User Pool.
- **Cost:** They pay their own AWS bill directly.

### 5.2 SaaS Cloud (Managed)

- **Multi-Tenancy:** We deploy a single "Production" stack.
- **Scale:** Aurora Serverless handles DB load. Lambda concurrency handles API spikes.
- **Isolation:** We use Amazon Verified Permissions (or Cognito Custom Attributes) to ensure Tenant A cannot invoke Tenant B's agent sessions.

---

## 6. Payment & Billing (SaaS Only)

**Provider:** Stripe

**Architecture:**

- **Stripe Webhook:** Points to an API Gateway endpoint → `BillingWebhook` Lambda.
- **Quota Management:** DynamoDB table tracks `Usage { org_id, scan_count }`.
- **Middleware:** The `ScanManager` Lambda checks DynamoDB before invoking Bedrock. If quota is exceeded, it returns `402 Payment Required`.

---

## 7. Roadmap & Phases

| Phase              | Description                                                    |
|--------------------|----------------------------------------------------------------|
| Phase 1 (MVP)      | CDK Stack for "Personal Deployment". React UI on S3.           |
| Phase 2 (Platform) | Bedrock Agent "Trace" visualization in the UI.                 |
| Phase 3 (SaaS)     | Multi-tenant Cognito setup and Stripe integration.             |
