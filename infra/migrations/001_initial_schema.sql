-- AccessAgents Initial Database Schema
-- Version: 1.0.0
-- Database: PostgreSQL 15 (Aurora Serverless v2)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Organizations Table
-- Represents a tenant/organization in multi-tenant mode
-- ============================================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default organization for self-hosted deployment
INSERT INTO organizations (id, name, plan)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default', 'unlimited');

-- ============================================================================
-- Users Table
-- Maps to Cognito User Pool users
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY,  -- Cognito sub
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    UNIQUE(org_id, email)
);

CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- Scan Sessions Table
-- Represents a single accessibility remediation workflow
-- ============================================================================
CREATE TABLE scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    viewport VARCHAR(10) NOT NULL CHECK (viewport IN ('mobile', 'desktop')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'remediating', 'complete', 'error')),
    error_message TEXT,
    bedrock_session_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_scan_sessions_org_id ON scan_sessions(org_id);
CREATE INDEX idx_scan_sessions_user_id ON scan_sessions(user_id);
CREATE INDEX idx_scan_sessions_status ON scan_sessions(status);
CREATE INDEX idx_scan_sessions_created_at ON scan_sessions(created_at DESC);

-- ============================================================================
-- Violations Table
-- Accessibility violations detected during scan
-- ============================================================================
CREATE TABLE violations (
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
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'fixed', 'skipped')),
    skip_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    fixed_at TIMESTAMPTZ
);

CREATE INDEX idx_violations_session_id ON violations(session_id);
CREATE INDEX idx_violations_status ON violations(status);
CREATE INDEX idx_violations_impact ON violations(impact);

-- ============================================================================
-- Applied Fixes Table
-- Records of fixes applied to violations
-- ============================================================================
CREATE TABLE applied_fixes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    violation_id UUID NOT NULL REFERENCES violations(id) ON DELETE CASCADE,
    fix_type VARCHAR(20) NOT NULL CHECK (fix_type IN ('attribute', 'content', 'style')),
    before_html TEXT,
    after_html TEXT,
    reasoning TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_applied_fixes_violation_id ON applied_fixes(violation_id);

-- ============================================================================
-- WebSocket Connections Table
-- Tracks active WebSocket connections for real-time updates
-- ============================================================================
CREATE TABLE websocket_connections (
    connection_id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES scan_sessions(id) ON DELETE CASCADE,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_ping_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_websocket_connections_session_id ON websocket_connections(session_id);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- Ensures data isolation between organizations
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_fixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE websocket_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for scan_sessions
CREATE POLICY scan_sessions_org_isolation ON scan_sessions
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- Create RLS policies for violations (through session)
CREATE POLICY violations_org_isolation ON violations
    FOR ALL
    USING (
        session_id IN (
            SELECT id FROM scan_sessions
            WHERE org_id = current_setting('app.current_org_id', true)::UUID
        )
    );

-- Create RLS policies for applied_fixes (through violation->session)
CREATE POLICY applied_fixes_org_isolation ON applied_fixes
    FOR ALL
    USING (
        violation_id IN (
            SELECT v.id FROM violations v
            JOIN scan_sessions s ON v.session_id = s.id
            WHERE s.org_id = current_setting('app.current_org_id', true)::UUID
        )
    );

-- Create RLS policies for websocket_connections
CREATE POLICY websocket_connections_org_isolation ON websocket_connections
    FOR ALL
    USING (
        user_id IN (
            SELECT id FROM users
            WHERE org_id = current_setting('app.current_org_id', true)::UUID
        )
    );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to set the current organization context for RLS
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

-- Create triggers for updated_at
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

-- ============================================================================
-- Views for Reporting
-- ============================================================================

-- Session summary view
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

-- Grant access to the service role (to be created during deployment)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO accessagents_service;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO accessagents_service;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO accessagents_service;

