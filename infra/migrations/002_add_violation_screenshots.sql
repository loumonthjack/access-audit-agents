-- Add screenshot column to violations table
-- Version: 1.0.1
-- This stores base64-encoded screenshots of violation elements

ALTER TABLE violations ADD COLUMN IF NOT EXISTS screenshot TEXT;

-- Add page screenshot to scan_sessions table
ALTER TABLE scan_sessions ADD COLUMN IF NOT EXISTS page_screenshot TEXT;

COMMENT ON COLUMN violations.screenshot IS 'Base64-encoded PNG screenshot of the violation element';
COMMENT ON COLUMN scan_sessions.page_screenshot IS 'Base64-encoded PNG screenshot of the full page';
