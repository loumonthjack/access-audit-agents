# AccessAgents Local API Server

Local Express API server for development and testing with real AWS Bedrock integration.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- AWS credentials configured (for Bedrock)

### 1. Start PostgreSQL

```bash
# From project root
docker-compose up -d
```

### 2. Configure Environment

Create `.env` file in this directory:

```env
PORT=3001
DATABASE_URL=postgresql://postgres:localdev123@localhost:5432/accessagents
BEDROCK_AGENT_ID=your-agent-id
BEDROCK_AGENT_ALIAS_ID=your-agent-alias-id
AWS_REGION=us-east-1
JWT_SECRET=your-local-dev-secret
```

Get `BEDROCK_AGENT_ID` and `BEDROCK_AGENT_ALIAS_ID` from CDK deployment:

```bash
cd ../../infra
npm run deploy:dev
npx cdk outputs
```

### 3. Install & Run

```bash
npm install
npm run dev
```

The API will be available at `http://localhost:3001`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| POST | /api/auth/login | Login (creates user if not exists) |
| GET | /api/auth/me | Get current user |
| POST | /api/scans | Start a new scan |
| GET | /api/scans/:id | Get scan status |
| GET | /api/sessions | List all sessions |
| DELETE | /api/sessions/:id | Delete a session |
| GET | /api/reports/:id | Get detailed report |
| GET | /api/reports/:id/export | Export report (JSON/HTML) |

## WebSocket

Connect to `ws://localhost:3001/ws` for real-time scan progress updates.

### Subscribe to session updates

```javascript
ws.send(JSON.stringify({ type: 'subscribe', sessionId: 'your-session-id' }));
```

### Event types

- `session:status` - Scan status changed
- `violation:detected` - New violation found
- `violation:fixed` - Violation was fixed
- `session:complete` - Scan finished
- `error` - Error occurred

## Running with Frontend

Configure the frontend to use this local API:

```bash
# apps/web/.env.local
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws
VITE_AUTH_MODE=self-hosted
VITE_ENABLE_MSW=false
```

Then start both:

```bash
# Terminal 1: API
cd apps/api && npm run dev

# Terminal 2: Frontend
cd apps/web && npm run dev
```

## Without Bedrock (Simulation Mode)

If `BEDROCK_AGENT_ID` is not set, the API runs in simulation mode:
- Scans complete after a short delay
- Mock violations are inserted
- No actual accessibility scanning occurs

This is useful for UI development without AWS costs.

