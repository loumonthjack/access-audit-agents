# Local Development Setup Guide

This guide walks you through setting up the AccessAgents platform for local development. By the end, you'll have the full stack running on your machine.

## Prerequisites

Before starting, ensure you have the following installed:

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18.x or higher | JavaScript runtime |
| npm | 9.x or higher | Package manager |
| Docker | 20.x or higher | Container runtime |
| Docker Compose | 2.x or higher | Multi-container orchestration |
| Git | 2.x or higher | Version control |

Optional (for AWS Bedrock integration):
- AWS CLI configured with credentials
- Access to Amazon Bedrock in your AWS account

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/access-agents.git
cd access-agents

# 2. Start Docker services
docker-compose up -d

# 3. Install dependencies and start services
cd apps/api && npm install && npm run dev &
cd apps/web && npm install && npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- API: http://localhost:3003
- Database: localhost:5434

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/access-agents.git
cd access-agents
```

### 2. Start Docker Services

The project uses Docker Compose to run PostgreSQL and Browserless (headless Chrome):

```bash
# Start all services in background
docker-compose up -d

# Verify services are running
docker-compose ps
```

Expected output:
```
NAME                      STATUS    PORTS
accessagents-db           running   0.0.0.0:5434->5432/tcp
accessagents-browserless  running   0.0.0.0:3000->3000/tcp
```

#### Docker Services Overview

| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| PostgreSQL | accessagents-db | 5434 | Database (Aurora replacement for local dev) |
| Browserless | accessagents-browserless | 3000 | Headless Chrome for accessibility scanning |
| pgAdmin | accessagents-pgadmin | 5050 | Database management UI (optional) |

To start pgAdmin for database management:
```bash
docker-compose --profile tools up -d
```

Access pgAdmin at http://localhost:5050 with:
- Email: admin@accessagents.local
- Password: admin123

### 3. Database Initialization

The database is automatically initialized when the PostgreSQL container starts. The migration script at `apps/api/migrations/001_local_schema.sql` creates all required tables.

To verify the database is ready:
```bash
docker exec -it accessagents-db psql -U postgres -d accessagents -c "\dt"
```

Expected tables:
- `organizations`
- `users`
- `scan_sessions`
- `violations`
- `applied_fixes`

#### Manual Migration (if needed)

If you need to reset or re-run migrations:
```bash
# Connect to database
docker exec -it accessagents-db psql -U postgres -d accessagents

# Drop and recreate (WARNING: destroys all data)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\i /docker-entrypoint-initdb.d/001_local_schema.sql
```

### 4. Configure the API Server

Navigate to the API directory and create the environment file:

```bash
cd apps/api
cp .env.example .env  # If .env.example exists, otherwise create manually
```

Edit `apps/api/.env` with the following configuration:

```env
# Server Configuration
PORT=3003

# Database Connection
DATABASE_URL=postgresql://postgres:localdev123@localhost:5434/accessagents

# AWS Bedrock (optional - for AI-powered scanning)
# BEDROCK_AGENT_ID=your-agent-id
# BEDROCK_AGENT_ALIAS_ID=your-agent-alias-id
AWS_REGION=us-east-1

# Authentication
JWT_SECRET=local-dev-secret-change-in-production
```

#### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | API server port (default: 3003) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for JWT token signing |
| `AWS_REGION` | No | AWS region for Bedrock |
| `BEDROCK_AGENT_ID` | No | Bedrock Agent ID (from CDK deployment) |
| `BEDROCK_AGENT_ALIAS_ID` | No | Bedrock Agent Alias ID |

**Note:** Without Bedrock credentials, the API runs in simulation mode with mock scan results.

### 5. Start the API Server

```bash
cd apps/api
npm install
npm run dev
```

The API server starts at http://localhost:3003. Verify it's running:
```bash
curl http://localhost:3003/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "development",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Configure the Frontend

Navigate to the web app directory and create the environment file:

```bash
cd apps/web
cp .env.example .env.local
```

Edit `apps/web/.env.local`:

```env
# API Configuration
VITE_API_URL=http://localhost:3003/api
VITE_WS_URL=ws://localhost:3003/ws

# Authentication Mode
VITE_AUTH_MODE=self-hosted

# Disable MSW mocking (use real API)
VITE_ENABLE_MSW=false
```

#### Frontend Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API URL |
| `VITE_WS_URL` | Yes | WebSocket URL for real-time updates |
| `VITE_AUTH_MODE` | Yes | `self-hosted` or `saas` |
| `VITE_ENABLE_MSW` | No | Enable Mock Service Worker |
| `VITE_COGNITO_*` | No | Required if `VITE_AUTH_MODE=saas` |

### 7. Start the Frontend

```bash
cd apps/web
npm install
npm run dev
```

The frontend starts at http://localhost:5173.

### 8. Verify the Full Stack

1. Open http://localhost:5173 in your browser
2. Log in with any email/password (users are auto-created in dev mode)
3. Start a scan by entering a URL
4. Verify real-time progress updates via WebSocket

## Running Both Services Together

For convenience, you can run both services in separate terminal windows:

**Terminal 1 - API:**
```bash
cd apps/api && npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd apps/web && npm run dev
```

## AWS Bedrock Integration (Optional)

To enable AI-powered accessibility scanning:

### 1. Deploy Infrastructure

```bash
cd infra
npm install
npm run deploy:dev
```

### 2. Get Bedrock Agent IDs

After deployment, retrieve the agent IDs:
```bash
npx cdk outputs
```

Look for:
- `BedrockAgentId`
- `BedrockAgentAliasId`

### 3. Update API Configuration

Add the IDs to `apps/api/.env`:
```env
BEDROCK_AGENT_ID=your-agent-id-from-outputs
BEDROCK_AGENT_ALIAS_ID=your-alias-id-from-outputs
```

### 4. Restart the API Server

```bash
cd apps/api
npm run dev
```

## Common Commands

| Command | Location | Description |
|---------|----------|-------------|
| `docker-compose up -d` | Root | Start Docker services |
| `docker-compose down` | Root | Stop Docker services |
| `docker-compose logs -f` | Root | View Docker logs |
| `npm run dev` | apps/api | Start API in dev mode |
| `npm run dev` | apps/web | Start frontend in dev mode |
| `npm run test` | apps/web | Run unit tests |
| `npm run test:e2e` | apps/web | Run E2E tests |
| `npm run build` | apps/web | Build for production |

## Troubleshooting

### Docker Issues

**Problem:** `docker-compose up` fails with port conflict
```
Error: Bind for 0.0.0.0:5434 failed: port is already allocated
```

**Solution:** Stop the conflicting service or change the port in `docker-compose.yml`:
```bash
# Find what's using the port
lsof -i :5434

# Or change the port mapping in docker-compose.yml
ports:
  - "5435:5432"  # Use a different host port
```

**Problem:** Database container keeps restarting

**Solution:** Check logs and ensure the data volume is healthy:
```bash
docker-compose logs postgres
docker volume rm accessagents-postgres-data  # Reset data (WARNING: destroys data)
docker-compose up -d
```

### Database Connection Issues

**Problem:** `ECONNREFUSED` when connecting to database

**Solution:** 
1. Verify PostgreSQL is running: `docker-compose ps`
2. Check the port matches your `.env` file (default: 5434)
3. Ensure `DATABASE_URL` uses `localhost`, not `127.0.0.1`

**Problem:** Authentication failed for user "postgres"

**Solution:** Verify credentials match `docker-compose.yml`:
```
POSTGRES_USER: postgres
POSTGRES_PASSWORD: localdev123
```

### API Server Issues

**Problem:** `MODULE_NOT_FOUND` errors

**Solution:** Reinstall dependencies:
```bash
cd apps/api
rm -rf node_modules
npm install
```

**Problem:** JWT token errors

**Solution:** Ensure `JWT_SECRET` is set in `.env`:
```env
JWT_SECRET=local-dev-secret-change-in-production
```

### Frontend Issues

**Problem:** CORS errors in browser console

**Solution:** Verify the API is running and CORS is configured:
1. Check API is running at the URL in `VITE_API_URL`
2. Ensure the frontend origin is in the API's CORS whitelist

**Problem:** WebSocket connection fails

**Solution:** 
1. Verify `VITE_WS_URL` matches the API WebSocket endpoint
2. Check that the API server is running
3. Look for WebSocket errors in API logs

### Bedrock Integration Issues

**Problem:** Scans complete instantly with no violations

**Solution:** This indicates simulation mode. To enable real scanning:
1. Deploy infrastructure: `cd infra && npm run deploy:dev`
2. Add Bedrock credentials to `apps/api/.env`
3. Restart the API server

**Problem:** Bedrock access denied errors

**Solution:** 
1. Verify AWS credentials are configured: `aws sts get-caller-identity`
2. Ensure your IAM user/role has Bedrock permissions
3. Check that Bedrock is enabled in your AWS region

## Next Steps

- [API Reference](./api_reference.md) - Detailed API documentation
- [Web App Setup](./web_app_setup.md) - Frontend architecture details
- [Testing Guide](../testing/local_testing_guide.md) - Running tests locally
- [Contributing Guide](./contributing.md) - How to contribute to the project
