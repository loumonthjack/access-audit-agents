/**
 * Migration Runner Lambda
 * 
 * Applies database migrations to Aurora PostgreSQL.
 * Invoked manually or during deployment to set up the schema.
 */

import { Pool } from 'pg';
import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

interface DatabaseCredentials {
    username: string;
    password: string;
    host: string;
    port: number;
    dbname: string;
}

const secretsClient = new SecretsManagerClient({});

async function getCredentials(secretArn: string): Promise<DatabaseCredentials> {
    const response = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretArn })
    );

    if (!response.SecretString) {
        throw new Error('Database credentials not found in Secrets Manager');
    }

    return JSON.parse(response.SecretString) as DatabaseCredentials;
}

// The migration SQL - embedded directly for simplicity
const MIGRATION_SQL = `
-- AccessAgents Initial Database Schema
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default organization for self-hosted deployment
INSERT INTO organizations (id, name, plan)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default', 'unlimited')
ON CONFLICT (id) DO NOTHING;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Scan Sessions Table
CREATE TABLE IF NOT EXISTS scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    viewport VARCHAR(10) NOT NULL CHECK (viewport IN ('mobile', 'desktop')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'remediating', 'complete', 'error')),
    error_message TEXT,
    page_screenshot TEXT,
    bedrock_session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scan_sessions_org_id ON scan_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_user_id ON scan_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_status ON scan_sessions(status);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_created_at ON scan_sessions(created_at DESC);

-- Violations Table
CREATE TABLE IF NOT EXISTS violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
    rule_id VARCHAR(100) NOT NULL,
    impact VARCHAR(20) NOT NULL CHECK (impact IN ('critical', 'serious', 'moderate', 'minor')),
    description TEXT NOT NULL,
    help TEXT,
    help_url TEXT,
    selector TEXT NOT NULL,
    html TEXT,
    failure_summary TEXT,
    screenshot TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'fixed', 'skipped')),
    skip_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    fixed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_violations_session_id ON violations(session_id);
CREATE INDEX IF NOT EXISTS idx_violations_status ON violations(status);
CREATE INDEX IF NOT EXISTS idx_violations_impact ON violations(impact);

-- Applied Fixes Table
CREATE TABLE IF NOT EXISTS applied_fixes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    violation_id UUID NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
    fix_type VARCHAR(20) NOT NULL CHECK (fix_type IN ('attribute', 'content', 'style')),
    before_html TEXT,
    after_html TEXT,
    reasoning TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applied_fixes_violation_id ON applied_fixes(violation_id);

-- WebSocket Connections Table
CREATE TABLE IF NOT EXISTS websocket_connections (
    connection_id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES scan_sessions(id) ON DELETE CASCADE,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_ping_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_websocket_connections_session_id ON websocket_connections(session_id);

-- Add screenshot columns if they don't exist (for existing databases)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'violations' AND column_name = 'screenshot') THEN
        ALTER TABLE violations ADD COLUMN screenshot TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scan_sessions' AND column_name = 'page_screenshot') THEN
        ALTER TABLE scan_sessions ADD COLUMN page_screenshot TEXT;
    END IF;
END $$;

-- Enable RLS on tables
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_fixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE websocket_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS scan_sessions_org_isolation ON scan_sessions;
DROP POLICY IF EXISTS violations_org_isolation ON violations;
DROP POLICY IF EXISTS applied_fixes_org_isolation ON applied_fixes;
DROP POLICY IF EXISTS websocket_connections_org_isolation ON websocket_connections;

-- Create RLS policies
CREATE POLICY scan_sessions_org_isolation ON scan_sessions
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::UUID);

CREATE POLICY violations_org_isolation ON violations
    FOR ALL
    USING (
        session_id IN (
            SELECT id FROM scan_sessions
            WHERE org_id = current_setting('app.current_org_id', true)::UUID
        )
    );

CREATE POLICY applied_fixes_org_isolation ON applied_fixes
    FOR ALL
    USING (
        violation_id IN (
            SELECT v.id FROM violations v
            JOIN scan_sessions s ON v.session_id = s.id
            WHERE s.org_id = current_setting('app.current_org_id', true)::UUID
        )
    );

CREATE POLICY websocket_connections_org_isolation ON websocket_connections
    FOR ALL
    USING (
        user_id IN (
            SELECT id FROM users
            WHERE org_id = current_setting('app.current_org_id', true)::UUID
        )
    );

-- Helper function to set organization context for RLS
CREATE OR REPLACE FUNCTION set_org_context(org_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_org_id', org_id::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers (drop first for idempotency)
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_scan_sessions_updated_at ON scan_sessions;
DROP TRIGGER IF EXISTS update_violations_updated_at ON violations;

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_scan_sessions_updated_at
    BEFORE UPDATE ON scan_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_violations_updated_at
    BEFORE UPDATE ON violations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Session summary view
DROP VIEW IF EXISTS session_summary;
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
    COUNT(v.id) FILTER (WHERE v.id IS NOT NULL) AS total_violations,
    COUNT(v.id) FILTER (WHERE v.impact = 'critical') AS critical_count,
    COUNT(v.id) FILTER (WHERE v.impact = 'serious') AS serious_count,
    COUNT(v.id) FILTER (WHERE v.impact = 'moderate') AS moderate_count,
    COUNT(v.id) FILTER (WHERE v.impact = 'minor') AS minor_count,
    COUNT(v.id) FILTER (WHERE v.status = 'fixed') AS fixed_count,
    COUNT(v.id) FILTER (WHERE v.status = 'skipped') AS skipped_count,
    COUNT(v.id) FILTER (WHERE v.status = 'pending') AS pending_count
FROM scan_sessions s
LEFT JOIN violations v ON v.session_id = s.id
GROUP BY s.id;

-- ============================================================================
-- Batch Scanning Schema (Migration 003)
-- ============================================================================

-- Batch Sessions Table
CREATE TABLE IF NOT EXISTS batch_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    viewport VARCHAR(20) NOT NULL CHECK (viewport IN ('mobile', 'desktop')),
    total_pages INTEGER NOT NULL,
    completed_pages INTEGER DEFAULT 0,
    failed_pages INTEGER DEFAULT 0,
    total_violations INTEGER DEFAULT 0,
    sitemap_url VARCHAR(2048),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    
    CONSTRAINT valid_batch_status CHECK (status IN (
        'pending', 'running', 'paused', 'completed', 'cancelled', 'error'
    ))
);

-- Batch Pages Table
CREATE TABLE IF NOT EXISTS batch_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES batch_sessions(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    scan_session_id UUID REFERENCES scan_sessions(id) ON DELETE SET NULL,
    violation_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_page_status CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'skipped'
    ))
);

-- Batch sessions indexes
CREATE INDEX IF NOT EXISTS idx_batch_sessions_user_id ON batch_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_org_id ON batch_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_status ON batch_sessions(status);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_user_created ON batch_sessions(user_id, created_at DESC);

-- Batch pages indexes
CREATE INDEX IF NOT EXISTS idx_batch_pages_batch_id ON batch_pages(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_pages_batch_status ON batch_pages(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_batch_pages_scan_session ON batch_pages(scan_session_id);

-- Triggers for batch tables
DROP TRIGGER IF EXISTS update_batch_sessions_updated_at ON batch_sessions;
DROP TRIGGER IF EXISTS update_batch_pages_updated_at ON batch_pages;

CREATE TRIGGER update_batch_sessions_updated_at
    BEFORE UPDATE ON batch_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_batch_pages_updated_at
    BEFORE UPDATE ON batch_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS on batch tables
ALTER TABLE batch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_pages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS batch_sessions_org_isolation ON batch_sessions;
DROP POLICY IF EXISTS batch_pages_org_isolation ON batch_pages;

-- Create RLS policies for batch_sessions
CREATE POLICY batch_sessions_org_isolation ON batch_sessions
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- Create RLS policies for batch_pages
CREATE POLICY batch_pages_org_isolation ON batch_pages
    FOR ALL
    USING (
        batch_id IN (
            SELECT id FROM batch_sessions
            WHERE org_id = current_setting('app.current_org_id', true)::UUID
        )
    );

-- Batch Summary View
DROP VIEW IF EXISTS batch_session_summary;
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

-- ============================================================================
-- WebSocket Batch Support (Migration 004)
-- ============================================================================

ALTER TABLE websocket_connections
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batch_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_websocket_connections_batch_id ON websocket_connections(batch_id);
`;

export const handler = async (event: unknown): Promise<{ statusCode: number; body: string }> => {
    console.log('Migration runner started');

    const secretArn = process.env.DATABASE_SECRET_ARN;
    const dbHost = process.env.DATABASE_HOST;

    if (!secretArn || !dbHost) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Missing database configuration' }),
        };
    }

    let pool: Pool | null = null;

    try {
        const credentials = await getCredentials(secretArn);

        pool = new Pool({
            host: dbHost,
            port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
            database: process.env.DATABASE_NAME ?? 'accessagents',
            user: credentials.username,
            password: credentials.password,
            max: 1,
            connectionTimeoutMillis: 10000,
            ssl: { rejectUnauthorized: false },
        });

        console.log('Connected to database, running migration...');

        // Run the migration
        await pool.query(MIGRATION_SQL);

        console.log('Migration completed successfully');

        // Verify the schema
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        const tables = result.rows.map(r => r.table_name);
        console.log('Tables created:', tables);

        // Verify the function exists
        const funcResult = await pool.query(`
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_type = 'FUNCTION'
        `);

        const functions = funcResult.rows.map(r => r.routine_name);
        console.log('Functions created:', functions);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Migration completed successfully',
                tables,
                functions,
            }),
        };
    } catch (error) {
        console.error('Migration failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Migration failed',
                details: error instanceof Error ? error.message : String(error),
            }),
        };
    } finally {
        if (pool) {
            await pool.end();
        }
    }
};
