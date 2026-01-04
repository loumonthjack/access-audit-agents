/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Base URL for REST API endpoints */
    readonly VITE_API_URL: string;
    /** WebSocket URL for real-time progress streaming */
    readonly VITE_WS_URL: string;
    /** Authentication mode: 'saas' or 'self-hosted' */
    readonly VITE_AUTH_MODE: 'saas' | 'self-hosted';
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
