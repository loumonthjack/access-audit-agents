/**
 * Browser Provider Interface
 * 
 * Abstraction layer for browser connections supporting both deployment modes:
 * - Self-Hosted (CE): Local Playwright browser instance
 * - SaaS (EE): Browserless.io via WebSocket endpoint
 * 
 * Requirements: 8.1, 8.4
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import type { Viewport } from '../types/index.js';

/**
 * Viewport dimensions for different device configurations
 */
export const VIEWPORT_DIMENSIONS = {
    mobile: { width: 375, height: 667 },
    desktop: { width: 1920, height: 1080 }
} as const;

/**
 * Configuration for browser provider
 */
export interface BrowserProviderConfig {
    /** Deployment mode: 'local' for self-hosted, 'browserless' for SaaS */
    mode: 'local' | 'browserless';
    /** Browserless.io WebSocket endpoint (required for browserless mode) */
    browserlessEndpoint?: string;
    /** Browserless.io API key (required for browserless mode) */
    browserlessApiKey?: string;
    /** Default viewport configuration */
    defaultViewport?: Viewport;
}

/**
 * Browser Provider Interface
 * 
 * Provides abstraction for obtaining browser connections regardless of deployment mode.
 */
export interface BrowserProvider {
    /** Establishes connection to the browser */
    connect(): Promise<Browser>;
    /** Closes the browser connection */
    disconnect(): Promise<void>;
    /** Returns whether the provider is currently connected */
    isConnected(): boolean;
    /** Creates a new browser context with specified viewport */
    createContext(viewport?: Viewport): Promise<BrowserContext>;
    /** Creates a new page in the given context */
    createPage(context: BrowserContext): Promise<Page>;
}


// Import providers directly for factory function
import { LocalPlaywrightProvider } from './local-playwright-provider.js';
import { BrowserlessProvider } from './browserless-provider.js';

/**
 * Factory function to create the appropriate browser provider based on configuration
 * 
 * Requirements: 8.4 - All mode differences encapsulated in Browser_Provider
 */
export function createBrowserProvider(config: BrowserProviderConfig): BrowserProvider {
    if (config.mode === 'browserless') {
        if (!config.browserlessEndpoint || !config.browserlessApiKey) {
            throw new Error(
                'Browserless mode requires both browserlessEndpoint and browserlessApiKey'
            );
        }
        return new BrowserlessProvider(
            config.browserlessEndpoint,
            config.browserlessApiKey,
            config.defaultViewport
        );
    }

    // Default to local Playwright provider
    return new LocalPlaywrightProvider(config.defaultViewport);
}
