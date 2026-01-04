-- Batch Scanning Schema for Local Development
-- Adds support for sitemap-based batch scanning of multiple URLs

-- ============================================================================
-- Batch Sessions Table
-- Represents a batch scan session that processes multiple URLs from a sitemap
-- ============================================================================
CREATE TABLE IF NOT EXISTS batch_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES organizations(id) ON DELETE CASCADE,
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

-- ============================================================================
-- Batch Pages Table
-- Individual pages within a batch scan session
-- ============================================================================
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

-- ============================================================================
-- Indexes for Efficient Queries
-- ============================================================================

-- Batch sessions indexes
CREATE INDEX IF NOT EXISTS idx_batch_sessions_user_id ON batch_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_org_id ON batch_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_status ON batch_sessions(status);
CREATE INDEX IF NOT EXISTS idx_batch_sessions_user_created ON batch_sessions(user_id, created_at DESC);

-- Batch pages indexes
CREATE INDEX IF NOT EXISTS idx_batch_pages_batch_id ON batch_pages(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_pages_batch_status ON batch_pages(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_batch_pages_scan_session ON batch_pages(scan_session_id);

-- ============================================================================
-- Triggers for Updated Timestamps
-- ============================================================================

DROP TRIGGER IF EXISTS update_batch_sessions_updated_at ON batch_sessions;
CREATE TRIGGER update_batch_sessions_updated_at
    BEFORE UPDATE ON batch_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_batch_pages_updated_at ON batch_pages;
CREATE TRIGGER update_batch_pages_updated_at
    BEFORE UPDATE ON batch_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
