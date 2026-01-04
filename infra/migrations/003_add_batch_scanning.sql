-- Batch Scanning Schema
-- Version: 1.0.2
-- Adds support for sitemap-based batch scanning of multiple URLs

-- ============================================================================
-- Batch Sessions Table
-- Represents a batch scan session that processes multiple URLs from a sitemap
-- ============================================================================
CREATE TABLE batch_sessions (
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

COMMENT ON TABLE batch_sessions IS 'Batch scan sessions for processing multiple URLs from a sitemap';
COMMENT ON COLUMN batch_sessions.sitemap_url IS 'Original sitemap URL used to discover pages';
COMMENT ON COLUMN batch_sessions.total_pages IS 'Total number of pages to scan in this batch';
COMMENT ON COLUMN batch_sessions.completed_pages IS 'Number of pages successfully scanned';
COMMENT ON COLUMN batch_sessions.failed_pages IS 'Number of pages that failed to scan';
COMMENT ON COLUMN batch_sessions.total_violations IS 'Aggregate count of violations across all scanned pages';

-- ============================================================================
-- Batch Pages Table
-- Individual pages within a batch scan session
-- ============================================================================
CREATE TABLE batch_pages (
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

COMMENT ON TABLE batch_pages IS 'Individual pages within a batch scan session';
COMMENT ON COLUMN batch_pages.scan_session_id IS 'Reference to the individual scan session for this page';
COMMENT ON COLUMN batch_pages.violation_count IS 'Number of violations found on this page';

-- ============================================================================
-- Indexes for Efficient Queries
-- ============================================================================

-- Batch sessions indexes
CREATE INDEX idx_batch_sessions_user_id ON batch_sessions(user_id);
CREATE INDEX idx_batch_sessions_org_id ON batch_sessions(org_id);
CREATE INDEX idx_batch_sessions_status ON batch_sessions(status);
CREATE INDEX idx_batch_sessions_user_created ON batch_sessions(user_id, created_at DESC);

-- Batch pages indexes
CREATE INDEX idx_batch_pages_batch_id ON batch_pages(batch_id);
CREATE INDEX idx_batch_pages_batch_status ON batch_pages(batch_id, status);
CREATE INDEX idx_batch_pages_scan_session ON batch_pages(scan_session_id);

-- ============================================================================
-- Triggers for Updated Timestamps
-- ============================================================================

CREATE TRIGGER update_batch_sessions_updated_at
    BEFORE UPDATE ON batch_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_batch_pages_updated_at
    BEFORE UPDATE ON batch_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on batch tables
ALTER TABLE batch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_pages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for batch_sessions
CREATE POLICY batch_sessions_org_isolation ON batch_sessions
    FOR ALL
    USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- Create RLS policies for batch_pages (through batch_session)
CREATE POLICY batch_pages_org_isolation ON batch_pages
    FOR ALL
    USING (
        batch_id IN (
            SELECT id FROM batch_sessions
            WHERE org_id = current_setting('app.current_org_id', true)::UUID
        )
    );

-- ============================================================================
-- Batch Summary View
-- ============================================================================

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

COMMENT ON VIEW batch_session_summary IS 'Summary view for batch scan sessions with progress information';
