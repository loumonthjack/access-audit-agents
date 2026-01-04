/**
 * Browserless.io Provider
 * 
 * Browser provider implementation for SaaS (EE) deployments.
 * Connects to Browserless.io via WebSocket endpoint for scalable browser automation.
 * 
 * Features:
 * - WebSocket connection to Browserless.io
 * - API key authentication
 * - Reconnection logic with exponential backoff
 * 
 * Requirements: 8.3
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { Viewport } from '../types/index.js';
import { BrowserProvider, VIEWPORT_DIMENSIONS } from './browser-provider.js';

/**
 * Retry configuration for reconnection logic
 */
const RETRY_CONFIG = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000
};

/**
 * Browserless.io Provider
 * 
 * Manages connection to Browserless.io for multi-tenant SaaS deployments.
 * Implements reconnection logic with exponential backoff.
 */
export class BrowserlessProvider implements BrowserProvider {
    private browser: Browser | null = null;
    private endpoint: string;
    private apiKey: string;
    private defaultViewport: Viewport;
    private connecting: Promise<Browser> | null = null;

    constructor(endpoint: string, apiKey: string, defaultViewport: Viewport = 'desktop') {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        this.defaultViewport = defaultViewport;
    }

    /**
     * Establishes connection to Browserless.io via WebSocket.
     * Implements reconnection logic with exponential backoff.
     */
    async connect(): Promise<Browser> {
        // Return existing browser if connected
        if (this.browser && this.browser.isConnected()) {
            return this.browser;
        }

        // If already connecting, wait for that connection
        if (this.connecting) {
            return this.connecting;
        }

        // Start new connection with retry logic
        this.connecting = this.connectWithRetry();

        try {
            this.browser = await this.connecting;
            return this.browser;
        } finally {
            this.connecting = null;
        }
    }

    /**
     * Connects to Browserless.io with exponential backoff retry logic
     */
    private async connectWithRetry(): Promise<Browser> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
            try {
                return await this.connectToBrowserless();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < RETRY_CONFIG.maxAttempts) {
                    const delay = Math.min(
                        RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
                        RETRY_CONFIG.maxDelayMs
                    );
                    await this.sleep(delay);
                }
            }
        }

        throw lastError ?? new Error('Failed to connect to Browserless.io');
    }


    /**
     * Establishes WebSocket connection to Browserless.io
     */
    private async connectToBrowserless(): Promise<Browser> {
        // Build WebSocket URL with API key authentication
        const wsEndpoint = this.buildWebSocketUrl();

        return chromium.connectOverCDP(wsEndpoint);
    }

    /**
     * Builds the WebSocket URL with API key authentication
     */
    private buildWebSocketUrl(): string {
        const url = new URL(this.endpoint);
        url.searchParams.set('token', this.apiKey);
        return url.toString();
    }

    /**
     * Utility function for delay in retry logic
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Closes the browser connection and cleans up resources.
     */
    async disconnect(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Returns whether the provider is currently connected to Browserless.io.
     */
    isConnected(): boolean {
        return this.browser !== null && this.browser.isConnected();
    }

    /**
     * Creates a new browser context with the specified viewport.
     */
    async createContext(viewport?: Viewport): Promise<BrowserContext> {
        const browser = await this.connect();
        const viewportType = viewport ?? this.defaultViewport;
        const dimensions = VIEWPORT_DIMENSIONS[viewportType];

        return browser.newContext({
            viewport: dimensions,
            userAgent: viewportType === 'mobile'
                ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
                : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
    }

    /**
     * Creates a new page in the given browser context.
     */
    async createPage(context: BrowserContext): Promise<Page> {
        return context.newPage();
    }
}
