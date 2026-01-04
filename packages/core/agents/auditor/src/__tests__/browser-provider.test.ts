/**
 * Unit tests for Browser Providers
 * 
 * Tests viewport configuration, default behavior, and connection handling.
 * Requirements: 3.1, 3.2, 3.3, 8.5
 */

import { describe, it, expect } from 'vitest';
import { LocalPlaywrightProvider } from '../providers/local-playwright-provider.js';
import {
    VIEWPORT_DIMENSIONS,
    createBrowserProvider,
    type BrowserProviderConfig
} from '../providers/browser-provider.js';

describe('VIEWPORT_DIMENSIONS', () => {
    it('should define mobile viewport as 375x667', () => {
        expect(VIEWPORT_DIMENSIONS.mobile).toEqual({ width: 375, height: 667 });
    });

    it('should define desktop viewport as 1920x1080', () => {
        expect(VIEWPORT_DIMENSIONS.desktop).toEqual({ width: 1920, height: 1080 });
    });
});

describe('LocalPlaywrightProvider', () => {
    describe('isConnected', () => {
        it('should return false when not connected', () => {
            const provider = new LocalPlaywrightProvider();
            expect(provider.isConnected()).toBe(false);
        });
    });

    describe('connect', () => {
        it('should establish browser connection', async () => {
            const provider = new LocalPlaywrightProvider();
            try {
                const browser = await provider.connect();
                expect(browser).toBeDefined();
                expect(provider.isConnected()).toBe(true);
            } finally {
                await provider.disconnect();
            }
        });

        it('should reuse existing connection (connection pooling)', async () => {
            const provider = new LocalPlaywrightProvider();
            try {
                const browser1 = await provider.connect();
                const browser2 = await provider.connect();
                expect(browser1).toBe(browser2);
            } finally {
                await provider.disconnect();
            }
        });
    });

    describe('createContext', () => {
        it('should create context with mobile viewport (375x667)', async () => {
            const provider = new LocalPlaywrightProvider('mobile');
            try {
                const context = await provider.createContext('mobile');
                const page = await context.newPage();
                const viewport = page.viewportSize();
                expect(viewport).toEqual({ width: 375, height: 667 });
                await page.close();
                await context.close();
            } finally {
                await provider.disconnect();
            }
        });

        it('should create context with desktop viewport (1920x1080)', async () => {
            const provider = new LocalPlaywrightProvider('desktop');
            try {
                const context = await provider.createContext('desktop');
                const page = await context.newPage();
                const viewport = page.viewportSize();
                expect(viewport).toEqual({ width: 1920, height: 1080 });
                await page.close();
                await context.close();
            } finally {
                await provider.disconnect();
            }
        });

        it('should default to desktop viewport when not specified', async () => {
            const provider = new LocalPlaywrightProvider();
            try {
                const context = await provider.createContext();
                const page = await context.newPage();
                const viewport = page.viewportSize();
                expect(viewport).toEqual({ width: 1920, height: 1080 });
                await page.close();
                await context.close();
            } finally {
                await provider.disconnect();
            }
        });
    });


    describe('disconnect', () => {
        it('should close browser connection', async () => {
            const provider = new LocalPlaywrightProvider();
            await provider.connect();
            expect(provider.isConnected()).toBe(true);
            await provider.disconnect();
            expect(provider.isConnected()).toBe(false);
        });
    });
});

describe('createBrowserProvider factory', () => {
    it('should create LocalPlaywrightProvider for local mode', () => {
        const config: BrowserProviderConfig = { mode: 'local' };
        const provider = createBrowserProvider(config);
        expect(provider).toBeInstanceOf(LocalPlaywrightProvider);
    });

    it('should throw error for browserless mode without endpoint', () => {
        const config: BrowserProviderConfig = {
            mode: 'browserless',
            browserlessApiKey: 'test-key'
        };
        expect(() => createBrowserProvider(config)).toThrow(
            'Browserless mode requires both browserlessEndpoint and browserlessApiKey'
        );
    });

    it('should throw error for browserless mode without API key', () => {
        const config: BrowserProviderConfig = {
            mode: 'browserless',
            browserlessEndpoint: 'wss://chrome.browserless.io'
        };
        expect(() => createBrowserProvider(config)).toThrow(
            'Browserless mode requires both browserlessEndpoint and browserlessApiKey'
        );
    });
});
