# Development, Testing & Dockerization Guide

**Project:** AccessAgents Platform  
**Architecture:** AWS Serverless (Bedrock + Lambda + React)

---

## 1. Development Testing Strategy

Since the architecture relies heavily on AWS managed services (Bedrock, API Gateway), strictly "local" testing is limited. We adopt a **"Cloud-First, Local-Unit"** testing strategy.

### 1.1 Unit Testing (Local)

We use Vitest or Jest to test the logic of Lambda functions and React components before they touch AWS.

- **Frontend (React):** Standard component testing.
- **Lambda Functions (Tools):**
  - Mock the AWS SDK calls (e.g., `mockClient(DynamoDB)`).
  - Test the business logic of the "GenerateFix" tool to ensure it produces valid JSON schema (Zod validation) without actually calling Bedrock.

**Command:** `npm run test:unit`

### 1.2 Integration Testing (The "Auditor" Lambda)

The Playwright browser logic is complex. We test this locally using the Docker container (see Section 2) before deploying to Lambda.

- **Strategy:** Run the Docker container locally and trigger the handler script with a mock event payload.
- **Goal:** Verify axe-core injection and report generation works on a sample HTML file.

### 1.3 Bedrock Agent Testing (Cloud Console)

Testing the Agent's "reasoning" requires the AWS cloud.

- **Trace Analysis:** Use the Amazon Bedrock Console "Test Window".
  - Enable "Trace" to see the Chain of Thought (CoT).
  - Verify the Agent correctly calls the Auditor Action Group when asked to "scan this site."
- **Regression Suite:** A script (`scripts/test-agent.ts`) that uses the `bedrock-agent-runtime` SDK to send 50 standard prompts and asserts the final response format.

---

## 2. Dockerization Instructions

While the architecture is "Serverless," the Auditor Node (Headless Browser) requires a custom Docker container because standard Lambda runtimes do not support the heavy dependencies required by Chromium/Playwright.

### 2.1 The Auditor Container (`/stacks/core/auditor/Dockerfile`)

We use the AWS Lambda Adapter pattern to run a standard web server (or direct handler) inside Lambda with Playwright pre-installed.

```dockerfile
# Use the official Microsoft Playwright image as base (Heavy but necessary)
FROM mcr.microsoft.com/playwright:v1.40.0-jammy as base

# Install AWS Lambda Web Adapter (allows running standard HTTP servers on Lambda)
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.7.0 /lambda-adapter /opt/extensions/lambda-adapter

# Set working directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code (The Axe-Core script)
COPY . .

# Environment configuration for Headless Chrome
ENV PORT=8080
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Command to run the handler
CMD ["node", "index.js"]
```

### 2.2 Building & Pushing the Image

To deploy this via CDK, the image must be built and uploaded to ECR (Elastic Container Registry).

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com

# Build
docker build -t access-agents-auditor ./stacks/core/auditor

# Tag & Push
docker tag access-agents-auditor:latest [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/access-agents-auditor:latest
docker push [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/access-agents-auditor:latest
```

---

## 3. Local Development Environment (DevContainer)

To ensure all engineers (and open-source contributors) use the same versions of AWS CDK, Node.js, and Docker, we provide a `.devcontainer` configuration.

**File:** `.devcontainer/Dockerfile`

```dockerfile
FROM mcr.microsoft.com/devcontainers/typescript-node:18

# Install AWS CDK
RUN npm install -g aws-cdk

# Install AWS CLI
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install

# Install Docker CLI (for Docker-in-Docker support)
RUN apt-get update && apt-get install -y docker.io
```

---

## 4. Deployment Checklists

### 4.1 "Personal Cloud" Deployment (Developer)

1. **Configure AWS:** Ensure `~/.aws/credentials` is set.
2. **Bootstrap CDK:** `cdk bootstrap aws://[ACCOUNT_ID]/[REGION]` (One time setup).
3. **Deploy Core:** `cdk deploy AccessAgents-CoreStack`
   - **Output:** Receives the `AgentId` and `AgentAliasId`.
4. **Deploy Frontend:** `cdk deploy AccessAgents-FrontendStack`
   - **Output:** Receives the `AmplifyAppURL`.

### 4.2 Production Deployment (CI/CD Pipeline)

1. **Lint & Test:** Run `npm run lint && npm run test`.
2. **Synth:** Run `cdk synth` to generate CloudFormation templates.
3. **Security Scan:** Run `cfn_nag` or `checkov` on the templates to ensure no IAM wildcards.
4. **Deploy:** Execute `cdk deploy --require-approval never` via GitHub Actions.
