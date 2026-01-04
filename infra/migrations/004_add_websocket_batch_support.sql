-- WebSocket Batch Support Migration
-- Version: 1.0.0
-- Adds batch_id column to websocket_connections for batch progress subscriptions

-- ============================================================================
-- Add batch_id column to websocket_connections
-- ============================================================================

ALTER TABLE websocket_connections
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES batch_sessions(id) ON DELETE SET NULL;

-- Create index for efficient batch subscription lookups
CREATE INDEX IF NOT EXISTS idx_websocket_connections_batch_id ON websocket_connections(batch_id);

COMMENT ON COLUMN websocket_connections.batch_id IS 'Reference to batch session for real-time batch progress updates';
