// WebSocket client exports
export { WebSocketClient } from './client';

export {
  calculateBackoffDelay,
  canReconnect,
  getBackoffSequence,
  ReconnectionManager,
} from './reconnect';

export { buildWebSocketUrl, isValidWebSocketUrl, parseWebSocketUrl } from './url';

export type {
  WSConnectionState,
  ReconnectConfig,
  WSClientConfig,
  WSClientEvent,
  WSEventHandler,
  ProgressEventHandler,
  WebSocketConstructor,
} from './types';

export type { WebSocketUrlParams } from './url';

export { DEFAULT_RECONNECT_CONFIG, DEFAULT_HEARTBEAT_INTERVAL_MS } from './types';
