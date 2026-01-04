import { create } from 'zustand';

export type ApiStatus = 'connected' | 'disconnected' | 'error';
export type WsStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export interface ConnectionState {
  // API connection status
  apiStatus: ApiStatus;

  // WebSocket connection status
  wsStatus: WsStatus;

  // Reconnection tracking
  reconnectAttempt: number;

  // Error tracking
  lastError: string | null;

  // Actions
  setApiStatus: (status: ApiStatus) => void;
  setWsStatus: (status: WsStatus) => void;
  setReconnectAttempt: (attempt: number) => void;
  incrementReconnectAttempt: () => void;
  resetReconnectAttempt: () => void;
  setLastError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  apiStatus: 'connected' as ApiStatus,
  wsStatus: 'disconnected' as WsStatus,
  reconnectAttempt: 0,
  lastError: null as string | null,
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  ...initialState,

  setApiStatus: (status) => set({ apiStatus: status }),

  setWsStatus: (status) => set({ wsStatus: status }),

  setReconnectAttempt: (attempt) => set({ reconnectAttempt: attempt }),

  incrementReconnectAttempt: () =>
    set((state) => ({ reconnectAttempt: state.reconnectAttempt + 1 })),

  resetReconnectAttempt: () => set({ reconnectAttempt: 0 }),

  setLastError: (error) => set({ lastError: error }),

  reset: () => set(initialState),
}));
