# Database Schema

This document describes the PostgreSQL database schema for AccessAgents, deployed on Amazon Aurora Serverless v2.

## Overview

The database stores scan sessions, detected violations, applied fixes, and user information. It supports multi-tenancy through organizations and enforces data isolation using PostgreSQL Row-Level Security (RLS).

## Entity Relationship Diagram

```
┌─────────────────┐
│  organizations  │
│─────────────────│
│  id (PK)        │
│  name           │
│  plan           │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐         ┌─────────────────────┐
│     users       │         │  websocket_         │
│─────────────────│         │  connections        │
│  id (PK)        │         │─────────────────────│
│  org_id (FK)    │◄────────│  connection_id (PK) │
│  email          │         │  user_id (FK)       │
│  name           │         │  session_id (FK)    │
│  role           │         └─────────────────────┘
└────────┬────────┘
         │
         ├─────────────────────────────┐
         │ 1:N                         │ 1:N
         ▼                             ▼
┌─────────────────┐           ┌─────────────────┐
│  scan_sessions  │           │ batch_sessions  │
│─────────────────│           │─────────────────│
│  id (PK)        │           │  id (PK)        │
│  org_id (FK)    │           │  org_id (FK)    │
│  user_id (FK)   │           │  user_id (FK)   │
│  url            │           │  sitemap_url    │
│  status         │           │  status         │
└────────┬────────┘           └────────┬────────┘
         │                             │
         │ 1:N                         │ 1:N
         ▼                             ▼
┌─────────────────┐           ┌─────────────────┐
│   violations    │           │  batch_pages    │
│─────────────────│           │─────────────────│
│  id (PK)        │           │  id (PK)        │
│  session_id(FK) │◄──────────│  batch_id (FK)  │
│  rule_id        │           │  scan_session_id│
│  impact         │           │  url            │
│  status         │           │  status         │
└────────┬────────┘           └─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│  applied_fixes  │
│─────────────────│
│  id (PK)        │
│  violation_id   │
│  fix_type       │
│  before_html    │
│  after_html     │
└─────────────────┘
```

## Tables

### Organizations

Represents a tenant or organization in the system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Organization name |
| plan | VARCHAR(50) | DEFAULT 'free' | Subscription plan |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

Default organization for self-hosted deployments:

```sql
INSERT INTO organizations (id, name, plan)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default', 'unlimited');
```

### Users

Maps to Cognito User Pool users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Cognito sub claim |
| org_id | UUID | NOT NULL, FK | Organization reference |
| email | VARCHAR(255) | NOT NULL | User email |
| name | VARCHAR(255) | - | Display name |
| role | VARCHAR(50) | DEFAULT 'member' | admin, member |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| last_login_at | TIMESTAMPTZ | - | Last login timestamp |

Indexes:

- `idx_users_org_id` on (org_id)
- `idx_users_email` on (email)

### Scan Sessions

Represents a single accessibility remediation workflow.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Session identifier |
| org_id | UUID | NOT NULL, FK | Organization reference |
| user_id | UUID | NOT NULL, FK | User who initiated |
| url | TEXT | NOT NULL | Target URL |
| viewport | VARCHAR(10) | NOT NULL, CHECK | mobile, desktop |
| status | VARCHAR(20) | NOT NULL, CHECK | Workflow status |
| error_message | TEXT | - | Error details if failed |
| bedrock_session_id | VARCHAR(255) | - | Bedrock agent session |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Start timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| completed_at | TIMESTAMPTZ | - | Completion timestamp |

Status values:

| Status | Description |
|--------|-------------|
| pending | Queued for processing |
| scanning | Running axe-core audit |
| remediating | Applying fixes |
| complete | Successfully finished |
| error | Failed with error |

Indexes:

- `idx_scan_sessions_org_id` on (org_id)
- `idx_scan_sessions_user_id` on (user_id)
- `idx_scan_sessions_status` on (status)
- `idx_scan_sessions_created_at` on (created_at DESC)

### Violations

Accessibility violations detected during a scan.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Violation identifier |
| session_id | UUID | NOT NULL, FK | Parent session |
| rule_id | VARCHAR(100) | NOT NULL | Axe-core rule ID |
| impact | VARCHAR(20) | NOT NULL, CHECK | Severity level |
| description | TEXT | NOT NULL | Violation description |
| help | TEXT | - | How to fix |
| help_url | TEXT | - | Documentation link |
| selector | TEXT | NOT NULL | CSS selector |
| html | TEXT | - | Element HTML |
| failure_summary | TEXT | - | Failure details |
| status | VARCHAR(20) | NOT NULL, CHECK | Fix status |
| skip_reason | TEXT | - | Why skipped |
| retry_count | INTEGER | DEFAULT 0 | Fix attempts |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Detection time |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| fixed_at | TIMESTAMPTZ | - | When fixed |

Impact levels (severity):

| Impact | Description |
|--------|-------------|
| critical | Users with disabilities cannot use |
| serious | Major barrier to access |
| moderate | Some difficulty for users |
| minor | Inconvenience |

Status values:

| Status | Description |
|--------|-------------|
| pending | Not yet processed |
| processing | Fix in progress |
| fixed | Successfully remediated |
| skipped | Flagged for human review |

Indexes:

- `idx_violations_session_id` on (session_id)
- `idx_violations_status` on (status)
- `idx_violations_impact` on (impact)

### Applied Fixes

Records of fixes applied to violations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Fix identifier |
| violation_id | UUID | NOT NULL, FK | Parent violation |
| fix_type | VARCHAR(20) | NOT NULL, CHECK | Type of fix |
| before_html | TEXT | - | Original HTML |
| after_html | TEXT | - | Modified HTML |
| reasoning | TEXT | - | AI explanation |
| applied_at | TIMESTAMPTZ | DEFAULT NOW() | Application time |

Fix types:

| Type | Description |
|------|-------------|
| attribute | Added/modified HTML attribute |
| content | Changed text content |
| style | Applied CSS changes |

Indexes:

- `idx_applied_fixes_violation_id` on (violation_id)

### WebSocket Connections

Tracks active WebSocket connections for real-time updates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| connection_id | VARCHAR(255) | PRIMARY KEY | API Gateway connection |
| user_id | UUID | FK | Connected user |
| session_id | UUID | FK | Subscribed session |
| connected_at | TIMESTAMPTZ | DEFAULT NOW() | Connection time |
| last_ping_at | TIMESTAMPTZ | DEFAULT NOW() | Last activity |

Indexes:

- `idx_websocket_connections_session_id` on (session_id)

### Batch Sessions

Represents a batch scan session that processes multiple URLs from a sitemap.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Batch session identifier |
| user_id | UUID | NOT NULL, FK | User who initiated |
| org_id | UUID | NOT NULL, FK | Organization reference |
| name | VARCHAR(255) | - | Optional batch name |
| status | VARCHAR(50) | NOT NULL, CHECK | Batch status |
| viewport | VARCHAR(20) | NOT NULL, CHECK | mobile, desktop |
| total_pages | INTEGER | NOT NULL | Total URLs to scan |
| completed_pages | INTEGER | DEFAULT 0 | Successfully scanned |
| failed_pages | INTEGER | DEFAULT 0 | Failed to scan |
| total_violations | INTEGER | DEFAULT 0 | Aggregate violations |
| sitemap_url | VARCHAR(2048) | - | Source sitemap URL |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |
| started_at | TIMESTAMPTZ | - | When scanning started |
| completed_at | TIMESTAMPTZ | - | When scanning finished |
| paused_at | TIMESTAMPTZ | - | When paused |

Batch status values:

| Status | Description |
|--------|-------------|
| pending | Queued for processing |
| running | Actively scanning pages |
| paused | Temporarily stopped |
| completed | All pages processed |
| cancelled | User cancelled |
| error | Failed with error |

Indexes:

- `idx_batch_sessions_user_id` on (user_id)
- `idx_batch_sessions_org_id` on (org_id)
- `idx_batch_sessions_status` on (status)
- `idx_batch_sessions_user_created` on (user_id, created_at DESC)

### Batch Pages

Individual pages within a batch scan session.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Page identifier |
| batch_id | UUID | NOT NULL, FK | Parent batch session |
| url | VARCHAR(2048) | NOT NULL | Page URL to scan |
| status | VARCHAR(50) | NOT NULL, CHECK | Page scan status |
| scan_session_id | UUID | FK | Individual scan session |
| violation_count | INTEGER | DEFAULT 0 | Violations found |
| error_message | TEXT | - | Error details if failed |
| started_at | TIMESTAMPTZ | - | When scan started |
| completed_at | TIMESTAMPTZ | - | When scan finished |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

Page status values:

| Status | Description |
|--------|-------------|
| pending | Not yet scanned |
| running | Currently scanning |
| completed | Successfully scanned |
| failed | Scan failed |
| skipped | Skipped by user |

Indexes:

- `idx_batch_pages_batch_id` on (batch_id)
- `idx_batch_pages_batch_status` on (batch_id, status)
- `idx_batch_pages_scan_session` on (scan_session_id)

## Row-Level Security

RLS policies ensure data isolation between organizations.

### Enabling RLS

```sql
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_fixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE websocket_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_pages ENABLE ROW LEVEL SECURITY;
```

### Policy Definitions

Scan sessions are isolated by organization:

```sql
CREATE POLICY scan_sessions_org_isolation ON scan_sessions
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::UUID);
```

Violations are isolated through their parent session:

```sql
CREATE POLICY violations_org_isolation ON violations
    FOR ALL
    USING (
        session_id IN (
            SELECT id FROM scan_sessions
            WHERE org_id = current_setting('app.current_org_id', true)::UUID
        )
    );
```

Batch sessions are isolated by organization:

```sql
CREATE POLICY batch_sessions_org_isolation ON batch_sessions
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::UUID);
```

Batch pages are isolated through their parent batch session:

```sql
CREATE POLICY batch_pages_org_isolation ON batch_pages
    FOR ALL
    USING (
        batch_id IN (
            SELECT id FROM batch_sessions
            WHERE org_id = current_setting('app.current_org_id', true)::UUID
        )
    );
```

### Setting Organization Context

Before executing queries, set the organization context:

```sql
SELECT set_org_context('org-uuid-here');
```

In Lambda functions:

```typescript
await pool.query(`SELECT set_org_context($1)`, [userOrgId]);
// Subsequent queries are automatically filtered
const sessions = await pool.query(`SELECT * FROM scan_sessions`);
```

## Views

### Session Summary

Aggregates violation statistics per session:

```sql
CREATE VIEW session_summary AS
SELECT
    s.id,
    s.org_id,
    s.user_id,
    s.url,
    s.viewport,
    s.status,
    s.created_at,
    s.completed_at,
    COUNT(v.id) AS total_violations,
    COUNT(v.id) FILTER (WHERE v.impact = 'critical') AS critical_count,
    COUNT(v.id) FILTER (WHERE v.impact = 'serious') AS serious_count,
    COUNT(v.id) FILTER (WHERE v.impact = 'moderate') AS moderate_count,
    COUNT(v.id) FILTER (WHERE v.impact = 'minor') AS minor_count,
    COUNT(v.id) FILTER (WHERE v.status = 'fixed') AS fixed_count,
    COUNT(v.id) FILTER (WHERE v.status = 'skipped') AS skipped_count
FROM scan_sessions s
LEFT JOIN violations v ON v.session_id = s.id
GROUP BY s.id;
```

Usage:

```sql
SELECT * FROM session_summary WHERE id = 'session-uuid';
```

### Batch Session Summary

Aggregates progress and statistics per batch scan:

```sql
CREATE VIEW batch_session_summary AS
SELECT
    bs.id,
    bs.org_id,
    bs.user_id,
    bs.name,
    bs.sitemap_url,
    bs.viewport,
    bs.status,
    bs.created_at,
    bs.started_at,
    bs.completed_at,
    bs.total_pages,
    bs.completed_pages,
    bs.failed_pages,
    bs.total_violations,
    COUNT(bp.id) FILTER (WHERE bp.status = 'pending') AS pending_pages,
    COUNT(bp.id) FILTER (WHERE bp.status = 'running') AS running_pages,
    CASE 
        WHEN bs.total_pages > 0 
        THEN ROUND((bs.completed_pages + bs.failed_pages)::NUMERIC / bs.total_pages * 100, 2)
        ELSE 0 
    END AS progress_percentage
FROM batch_sessions bs
LEFT JOIN batch_pages bp ON bp.batch_id = bs.id
GROUP BY bs.id;
```

Usage:

```sql
SELECT * FROM batch_session_summary WHERE id = 'batch-uuid';
```

## Helper Functions

### Update Timestamp Trigger

Automatically updates `updated_at` on row modification:

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Applied to all tables with `updated_at` column.

## Migrations

Migrations are stored in `infra/migrations/`:

| File | Description |
|------|-------------|
| 001_initial_schema.sql | Initial table creation |
| 002_add_violation_screenshots.sql | Add screenshot columns |
| 003_add_batch_scanning.sql | Batch scanning tables |

### Running Migrations

```bash
# Connect to Aurora via bastion or VPN
psql -h cluster-endpoint -U postgres -d accessagents \
  -f infra/migrations/001_initial_schema.sql
```

### Migration Best Practices

1. Always use transactions
2. Include rollback statements
3. Test on staging before production
4. Version control all migrations
5. Never modify existing migrations

## Performance Considerations

### Index Strategy

Primary query patterns and their supporting indexes:

| Query Pattern | Index |
|---------------|-------|
| List sessions by org | idx_scan_sessions_org_id |
| List sessions by user | idx_scan_sessions_user_id |
| Recent sessions | idx_scan_sessions_created_at |
| Violations by session | idx_violations_session_id |
| Pending violations | idx_violations_status |

### Connection Pooling

Lambda functions should use connection pooling:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
```

### Query Optimization

For large result sets, use pagination:

```sql
SELECT * FROM scan_sessions
WHERE org_id = $1
ORDER BY created_at DESC
LIMIT 20 OFFSET $2;
```

## Backup and Recovery

Aurora Serverless v2 provides:

- Continuous backups to S3
- Point-in-time recovery (7 days retention)
- Automated snapshots

Recovery time objective (RTO): ~5 minutes

## References

- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Aurora Serverless v2: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html


