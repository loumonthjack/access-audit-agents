/**
 * Local Playwright Provider
 * 
 * Browser provider implementation for self-hosted (CE) deployments.
 * Launches a local Chromium instance via Playwright.
 * 
 * Features:
 * - Connection pooling for Lambda warm starts
 * - Viewport configuration (mobile: 375x667, desktop: 1920x1080)
 * 
 * Requirements: 3.1, 3.2, 3.3, 8.2
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { Viewport } from '../types/index.js';
import { BrowserProvider, VIEWPORT_DIMENSIONS } from './browser-provider.js';

/**
 * Local Playwright Provider
 * 
 * Manages a local Chromium browser instance for accessibility scanning.
 * Implements connection pooling to reuse browser instances across Lambda invocations.
 */
export class LocalPlaywrightProvider implements BrowserProvider {
    private browser: Browser | null = null;
    private defaultViewport: Viewport;
    private connecting: Promise<Browser> | null = null;

    constructor(defaultViewport: Viewport = 'desktop') {
        this.defaultViewport = defaultViewport;
    }

    /**
     * Establishes connection to a local Chromium browser.
     * Reuses existing connection if available (connection pooling for Lambda warm starts).
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

        // Start new connection
        this.connecting = this.launchBrowser();

        try {
            this.browser = await this.connecting;
            return this.browser;
        } finally {
            this.connecting = null;
        }
    }

    /**
     * Launches a new Chromium browser instance
     */
    private async launchBrowser(): Promise<Browser> {
        return chromium.launch({
            headless: true,
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--single-process'
            ]
        });
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
     * Returns whether the provider is currently connected to a browser.
     */
    isConnected(): boolean {
        return this.browser !== null && this.browser.isConnected();
    }

    /**
     * Creates a new browser context with the specified viewport.
     * 
     * Requirements:
     * - 3.1: Mobile viewport = 375x667
     * - 3.2: Desktop viewport = 1920x1080
     * - 3.3: Default to desktop if not specified
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
