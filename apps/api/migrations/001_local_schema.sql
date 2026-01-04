-- Local Development Schema
-- Simplified schema without RLS for local testing

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default organization for local development
INSERT INTO organizations (id, name, plan)
VALUES ('00000000-0000-0000-0000-000000000000', 'Local Dev', 'unlimited')
ON CONFLICT (id) DO NOTHING;

-- Users Table (simplified for local auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Scan Sessions Table
CREATE TABLE IF NOT EXISTS scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES organizations(id) ON DELETE CASCADE,
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

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_scan_sessions_updated_at ON scan_sessions;
CREATE TRIGGER update_scan_sessions_updated_at
    BEFORE UPDATE ON scan_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_violations_updated_at ON violations;
CREATE TRIGGER update_violations_updated_at
    BEFORE UPDATE ON violations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

