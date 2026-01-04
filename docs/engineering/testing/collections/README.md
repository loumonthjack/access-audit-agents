# Postman Collections

This folder contains Postman collections for testing the AccessAgents API.

## Collections

| Collection | Description |
|------------|-------------|
| [AccessAgents-Auth](./AccessAgents-Auth.postman_collection.json) | Authentication endpoints (login, logout, user profile) |
| [AccessAgents-Scans](./AccessAgents-Scans.postman_collection.json) | Single page scanning endpoints |
| [AccessAgents-Sessions](./AccessAgents-Sessions.postman_collection.json) | Session management (list, delete) |
| [AccessAgents-Reports](./AccessAgents-Reports.postman_collection.json) | Report generation and export |
| [AccessAgents-BatchScans](./AccessAgents-BatchScans.postman_collection.json) | Batch/sitemap scanning endpoints |

## Environment

Import the environment file for local development:

- [AccessAgents-Environment](./AccessAgents-Environment.postman_environment.json) - Local development variables

## Quick Start

1. **Import Collections**: In Postman, click Import and select all `.json` files from this folder
2. **Import Environment**: Import `AccessAgents-Environment.postman_environment.json`
3. **Select Environment**: Choose "AccessAgents - Local Development" from the environment dropdown
4. **Start Local Server**: Run `cd apps/api && npm run dev`
5. **Authenticate**: Run the "Login" request first - it automatically saves the token

## Workflow

### Single Page Scan

1. Run **Login** (Auth collection)
2. Run **Start Scan** (Scans collection) - saves `sessionId`
3. Run **Get Scan Status** to check progress
4. Run **Get Scan Violations** to see results
5. Run **Get Report** (Reports collection) for full details

### Batch Scan

1. Run **Login** (Auth collection)
2. Run **Parse Sitemap** (BatchScans collection) to discover URLs
3. Run **Create Batch Scan** - saves `batchId`
4. Run **Get Batch Status** to monitor progress
5. Run **Get Batch Pages** to see individual page results
6. Run **Get Batch Report** for comprehensive analysis

## Variables

Collections use these variables (auto-populated by test scripts):

| Variable | Description | Auto-set by |
|----------|-------------|-------------|
| `baseUrl` | API base URL | Environment |
| `token` | JWT auth token | Login request |
| `sessionId` | Single scan session ID | Start Scan request |
| `batchId` | Batch scan ID | Create Batch Scan request |

## Production Environment

For production testing, create a new environment with:

```json
{
  "baseUrl": "https://{api-id}.execute-api.{region}.amazonaws.com/prod",
  "wsUrl": "wss://{api-id}.execute-api.{region}.amazonaws.com/prod"
}
```

## Related Documentation

- [API Reference](../../development/api_reference.md)
- [Local Testing Guide](../local_testing_guide.md)
- [Testing Strategy](../testing_strategy.md)
