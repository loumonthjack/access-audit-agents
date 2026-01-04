/**
 * Unit Tests for ScannerService
 *
 * Tests the ScannerService class with mocked dependencies.
 * Improves coverage for scanner.ts methods.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScannerService, DEFAULT_PAGE_SIZE, DEFAULT_TIMEOUT_MS } from '../services/scanner.js';
import type { BrowserProvider } from '../providers/browser-provider.js';
import type { BrowserContext, Page } from 'playwright';

// Mock AxeBuilder
vi.mock('@axe-core/playwright', () => ({
    default: vi.fn().mockImplementation(() => ({
        withTags: vi.fn().mockReturnThis(),
        analyze: vi.fn()
    }))
}));

const createMockPage = (): Page => ({
    goto: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    evaluate: vi.fn(),
    waitForLoadState: vi.fn()
} as unknown as Page);

const createMockContext = (): BrowserContext => ({
    close: vi.fn().mockResolvedValue(undefined),
    newPage: vi.fn()
} as unknown as BrowserContext);

const createMockBrowserProvider = (mockPage: Page, mockContext: BrowserContext): BrowserProvider => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    createContext: vi.fn().mockResolvedValue(mockContext),
    createPage: vi.fn().mockResolvedValue(mockPage),
    isConnected: vi.fn().mockReturnValue(true)
});

describe('ScannerService', () => {
    let scanner: ScannerService;
    let mockPage: Page;
    let mockContext: BrowserContext;
    let mockProvider: BrowserProvider;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPage = createMockPage();
        mockContext = createMockContext();
        mockProvider = createMockBrowserProvider(mockPage, mockContext);
        scanner = new ScannerService(mockProvider);
    });

    describe('constructor', () => {
        it('should create scanner with browser provider', () => {
            expect(scanner).toBeDefined();
        });
    });

    describe('scan()', () => {
        it('should scan URL and return ScanResult', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({
                    violations: [
                        {
                            id: 'color-contrast',
                            impact: 'serious',
                            description: 'Color contrast issue',
                            help: 'Ensure contrast ratio',
                            helpUrl: 'https://dequeuniversity.com',
                            nodes: [{
                                target: ['#element'],
                                html: '<div id="element">Test</div>',
                                failureSummary: 'Low contrast'
                            }]
                        }
                    ]
                })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({ url: 'https://example.com' });

            expect(result).toBeDefined();
            expect(result.schemaVersion).toBeDefined();
            expect(result.metadata.url).toBe('https://example.com');
            expect(result.violations.length).toBe(1);
            expect(result.violations[0].id).toBe('color-contrast');
            expect(result.violations[0].impact).toBe('serious');
        });

        it('should use desktop viewport by default', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({ violations: [] })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({ url: 'https://example.com' });

            expect(result.metadata.viewport).toBe('desktop');
            expect(mockProvider.createContext).toHaveBeenCalledWith('desktop');
        });

        it('should use custom viewport when provided', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({ violations: [] })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({
                url: 'https://example.com',
                viewport: 'mobile'
            });

            expect(result.metadata.viewport).toBe('mobile');
            expect(mockProvider.createContext).toHaveBeenCalledWith('mobile');
        });

        it('should handle empty violations', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({ violations: [] })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({ url: 'https://example.com' });

            expect(result.violations).toEqual([]);
            expect(result.metadata.violationCounts.total).toBe(0);
            expect(result.pagination.hasMoreViolations).toBe(false);
        });

        it('should sort violations by impact level', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({
                    violations: [
                        { id: 'minor-issue', impact: 'minor', description: '', help: '', helpUrl: '', nodes: [] },
                        { id: 'critical-issue', impact: 'critical', description: '', help: '', helpUrl: '', nodes: [] },
                        { id: 'moderate-issue', impact: 'moderate', description: '', help: '', helpUrl: '', nodes: [] },
                        { id: 'serious-issue', impact: 'serious', description: '', help: '', helpUrl: '', nodes: [] }
                    ]
                })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({ url: 'https://example.com' });

            expect(result.violations[0].id).toBe('critical-issue');
            expect(result.violations[1].id).toBe('serious-issue');
            expect(result.violations[2].id).toBe('moderate-issue');
            expect(result.violations[3].id).toBe('minor-issue');
        });

        it('should paginate violations correctly', async () => {
            const manyViolations = Array.from({ length: 15 }, (_, i) => ({
                id: `violation-${i}`,
                impact: 'moderate',
                description: `Violation ${i}`,
                help: 'Help text',
                helpUrl: 'https://help.url',
                nodes: []
            }));

            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({ violations: manyViolations })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({ url: 'https://example.com', page: 1 });

            expect(result.violations.length).toBe(DEFAULT_PAGE_SIZE);
            expect(result.pagination.hasMoreViolations).toBe(true);
            expect(result.pagination.totalPages).toBe(2);
            expect(result.metadata.violationCounts.total).toBe(15);
        });

        it('should close page and context after scan', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({ violations: [] })
            } as ReturnType<typeof AxeBuilder>));

            await scanner.scan({ url: 'https://example.com' });

            expect(mockPage.close).toHaveBeenCalled();
            expect(mockContext.close).toHaveBeenCalled();
        });

        it('should clean up on error', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockRejectedValue(new Error('Axe failed'))
            } as ReturnType<typeof AxeBuilder>));

            await expect(scanner.scan({ url: 'https://example.com' })).rejects.toMatchObject({
                code: 'AXE_INJECTION_FAILED'
            });

            expect(mockPage.close).toHaveBeenCalled();
            expect(mockContext.close).toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should throw TIMEOUT error on page timeout', async () => {
            vi.mocked(mockPage.goto).mockRejectedValue(new Error('Timeout exceeded'));

            await expect(scanner.scan({ url: 'https://example.com' })).rejects.toMatchObject({
                code: 'TIMEOUT',
                message: expect.stringContaining(`${DEFAULT_TIMEOUT_MS}ms`)
            });
        });

        it('should throw URL_UNREACHABLE on network error', async () => {
            vi.mocked(mockPage.goto).mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

            await expect(scanner.scan({ url: 'https://invalid-url.test' })).rejects.toMatchObject({
                code: 'URL_UNREACHABLE'
            });
        });

        it('should throw AXE_INJECTION_FAILED on axe-core error', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockRejectedValue(new Error('Script injection failed'))
            } as ReturnType<typeof AxeBuilder>));

            await expect(scanner.scan({ url: 'https://example.com' })).rejects.toMatchObject({
                code: 'AXE_INJECTION_FAILED'
            });
        });
    });

    describe('impact normalization', () => {
        it('should normalize unknown impact to minor', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({
                    violations: [{
                        id: 'test',
                        impact: 'unknown-impact',
                        description: '',
                        help: '',
                        helpUrl: '',
                        nodes: []
                    }]
                })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({ url: 'https://example.com' });

            expect(result.violations[0].impact).toBe('minor');
        });

        it('should handle undefined impact', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({
                    violations: [{
                        id: 'test',
                        impact: undefined,
                        description: '',
                        help: '',
                        helpUrl: '',
                        nodes: []
                    }]
                })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({ url: 'https://example.com' });

            expect(result.violations[0].impact).toBe('minor');
        });
    });

    describe('violation counts', () => {
        it('should calculate correct violation counts', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({
                    violations: [
                        { id: '1', impact: 'critical', description: '', help: '', helpUrl: '', nodes: [] },
                        { id: '2', impact: 'critical', description: '', help: '', helpUrl: '', nodes: [] },
                        { id: '3', impact: 'serious', description: '', help: '', helpUrl: '', nodes: [] },
                        { id: '4', impact: 'moderate', description: '', help: '', helpUrl: '', nodes: [] },
                        { id: '5', impact: 'minor', description: '', help: '', helpUrl: '', nodes: [] }
                    ]
                })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({ url: 'https://example.com' });

            expect(result.metadata.violationCounts.critical).toBe(2);
            expect(result.metadata.violationCounts.serious).toBe(1);
            expect(result.metadata.violationCounts.moderate).toBe(1);
            expect(result.metadata.violationCounts.minor).toBe(1);
            expect(result.metadata.violationCounts.total).toBe(5);
        });
    });

    describe('node transformation', () => {
        it('should transform violation nodes correctly', async () => {
            const AxeBuilder = (await import('@axe-core/playwright')).default;
            vi.mocked(AxeBuilder).mockImplementation(() => ({
                withTags: vi.fn().mockReturnThis(),
                analyze: vi.fn().mockResolvedValue({
                    violations: [{
                        id: 'test',
                        impact: 'serious',
                        description: 'Test violation',
                        help: 'Fix this',
                        helpUrl: 'https://help.url',
                        nodes: [
                            {
                                target: ['html', 'body', 'div#main'],
                                html: '<div id="main">Content</div>',
                                failureSummary: 'Element has issues'
                            },
                            {
                                target: ['button.submit'],
                                html: '<button class="submit">Click</button>'
                                // No failureSummary - should default
                            }
                        ]
                    }]
                })
            } as ReturnType<typeof AxeBuilder>));

            const result = await scanner.scan({ url: 'https://example.com' });

            expect(result.violations[0].nodes.length).toBe(2);
            expect(result.violations[0].nodes[0].selector).toBe('html > body > div#main');
            expect(result.violations[0].nodes[0].html).toBe('<div id="main">Content</div>');
            expect(result.violations[0].nodes[0].failureSummary).toBe('Element has issues');
            expect(result.violations[0].nodes[1].failureSummary).toBe('No failure summary available');
        });
    });
});

