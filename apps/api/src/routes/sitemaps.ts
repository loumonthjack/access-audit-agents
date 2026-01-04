/**
 * Sitemap Routes
 *
 * Endpoints for parsing sitemap URLs and extracting page URLs.
 * Requirements: 6.2, 6.4
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

export const sitemapRoutes = Router();

sitemapRoutes.use(authMiddleware);

// ============================================================================
// Types
// ============================================================================

interface SitemapParseRequest {
    sitemapUrl: string;
    maxUrls?: number;
}

interface ParsedUrl {
    loc: string;
    lastmod?: string;
    changefreq?: string;
    priority?: number;
}

interface SitemapParseResponse {
    urls: ParsedUrl[];
    totalCount: number;
    truncated: boolean;
    sitemapType: 'standard' | 'index';
    parseTime: number;
    errors: string[];
}

interface SitemapValidationResult {
    valid: boolean;
    error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_URLS = 1000;
const MAX_URLS_LIMIT = 50000;
const FETCH_TIMEOUT_MS = 30000;
const MAX_RECURSION_DEPTH = 2;
const MAX_SITEMAP_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validates that a URL is a valid sitemap URL.
 * Requirements: 6.1 - URL should end with .xml or contain /sitemap
 */
function validateSitemapUrl(url: string): SitemapValidationResult {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'Sitemap URL is required' };
    }

    const trimmedUrl = url.trim();

    // Validate URL format
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(trimmedUrl);
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }

    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    // Check if URL ends with .xml or contains /sitemap
    const pathname = parsedUrl.pathname.toLowerCase();
    const isXmlFile = pathname.endsWith('.xml');
    const containsSitemap = pathname.includes('/sitemap') || parsedUrl.href.toLowerCase().includes('sitemap');

    if (!isXmlFile && !containsSitemap) {
        return {
            valid: false,
            error: 'URL should be a sitemap (ending in .xml or containing /sitemap)',
        };
    }

    return { valid: true };
}

/**
 * Validates that a page URL belongs to the same domain as the sitemap.
 */
function validateDomain(sitemapUrl: string, pageUrl: string): boolean {
    try {
        const sitemapHost = new URL(sitemapUrl).hostname.toLowerCase();
        const pageHost = new URL(pageUrl).hostname.toLowerCase();

        // Allow exact match or subdomain match
        return pageHost === sitemapHost || pageHost.endsWith(`.${sitemapHost}`);
    } catch {
        return false;
    }
}

// ============================================================================
// XML Fetching
// ============================================================================

/**
 * Fetches sitemap XML content with timeout and size limits.
 */
async function fetchSitemap(url: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'AccessAgents-SitemapParser/1.0',
                Accept: 'application/xml, text/xml, */*',
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Sitemap not found');
            }
            throw new Error(`Failed to fetch sitemap: HTTP ${response.status}`);
        }

        // Check content length if available
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_SITEMAP_SIZE_BYTES) {
            throw new Error('Sitemap file is too large');
        }

        const text = await response.text();

        if (text.length > MAX_SITEMAP_SIZE_BYTES) {
            throw new Error('Sitemap file is too large');
        }

        return text;
    } catch (error) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error('Sitemap fetch timed out');
            }
            throw error;
        }
        throw new Error('Failed to fetch sitemap');
    } finally {
        clearTimeout(timeoutId);
    }
}

// ============================================================================
// XML Parsing
// ============================================================================

/**
 * Detects if the XML is a sitemap index or standard sitemap.
 */
function detectSitemapType(xml: string): 'standard' | 'index' {
    if (xml.includes('<sitemapindex') || xml.includes(':sitemapindex')) {
        return 'index';
    }
    return 'standard';
}

/**
 * Decodes XML entities in a string.
 */
function decodeXmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}

/**
 * Parses a standard sitemap XML and extracts URLs.
 */
function parseStandardSitemap(xml: string): ParsedUrl[] {
    const urls: ParsedUrl[] = [];

    const urlBlockRegex = /<url[^>]*>([\s\S]*?)<\/url>/gi;
    let urlMatch;

    while ((urlMatch = urlBlockRegex.exec(xml)) !== null) {
        const urlBlock = urlMatch[1];

        const locMatch = urlBlock.match(/<loc[^>]*>([\s\S]*?)<\/loc>/i);
        if (!locMatch) continue;

        const loc = decodeXmlEntities(locMatch[1].trim());
        if (!loc) continue;

        const parsedUrl: ParsedUrl = { loc };

        const lastmodMatch = urlBlock.match(/<lastmod[^>]*>([\s\S]*?)<\/lastmod>/i);
        if (lastmodMatch) {
            parsedUrl.lastmod = lastmodMatch[1].trim();
        }

        const changefreqMatch = urlBlock.match(/<changefreq[^>]*>([\s\S]*?)<\/changefreq>/i);
        if (changefreqMatch) {
            parsedUrl.changefreq = changefreqMatch[1].trim();
        }

        const priorityMatch = urlBlock.match(/<priority[^>]*>([\s\S]*?)<\/priority>/i);
        if (priorityMatch) {
            const priority = parseFloat(priorityMatch[1].trim());
            if (!isNaN(priority) && priority >= 0 && priority <= 1) {
                parsedUrl.priority = priority;
            }
        }

        urls.push(parsedUrl);
    }

    return urls;
}

/**
 * Parses a sitemap index XML and extracts child sitemap URLs.
 */
function parseSitemapIndex(xml: string): string[] {
    const sitemapUrls: string[] = [];

    const sitemapBlockRegex = /<sitemap[^>]*>([\s\S]*?)<\/sitemap>/gi;
    let sitemapMatch;

    while ((sitemapMatch = sitemapBlockRegex.exec(xml)) !== null) {
        const sitemapBlock = sitemapMatch[1];

        const locMatch = sitemapBlock.match(/<loc[^>]*>([\s\S]*?)<\/loc>/i);
        if (locMatch) {
            const loc = decodeXmlEntities(locMatch[1].trim());
            if (loc) {
                sitemapUrls.push(loc);
            }
        }
    }

    return sitemapUrls;
}

// ============================================================================
// Sitemap Parser Class
// ============================================================================

class SitemapParser {
    private maxUrls: number;
    private sitemapUrl: string;
    private collectedUrls: ParsedUrl[] = [];
    private errors: string[] = [];
    private sitemapType: 'standard' | 'index' = 'standard';

    constructor(sitemapUrl: string, maxUrls: number = DEFAULT_MAX_URLS) {
        this.sitemapUrl = sitemapUrl;
        this.maxUrls = Math.min(maxUrls, MAX_URLS_LIMIT);
    }

    async parse(): Promise<SitemapParseResponse> {
        const startTime = Date.now();

        try {
            await this.parseSitemapRecursive(this.sitemapUrl, 0);
        } catch (error) {
            this.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }

        const parseTime = Date.now() - startTime;
        const truncated = this.collectedUrls.length >= this.maxUrls;

        return {
            urls: this.collectedUrls.slice(0, this.maxUrls),
            totalCount: this.collectedUrls.length,
            truncated,
            sitemapType: this.sitemapType,
            parseTime,
            errors: this.errors,
        };
    }

    private async parseSitemapRecursive(url: string, depth: number): Promise<void> {
        if (depth > MAX_RECURSION_DEPTH) {
            this.errors.push(`Max recursion depth exceeded for: ${url}`);
            return;
        }

        if (this.collectedUrls.length >= this.maxUrls) {
            return;
        }

        let xml: string;
        try {
            xml = await fetchSitemap(url);
        } catch (error) {
            this.errors.push(`Failed to fetch ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return;
        }

        const type = detectSitemapType(xml);

        if (depth === 0) {
            this.sitemapType = type;
        }

        if (type === 'index') {
            const childSitemapUrls = parseSitemapIndex(xml);

            for (const childUrl of childSitemapUrls) {
                if (this.collectedUrls.length >= this.maxUrls) {
                    break;
                }

                if (!validateDomain(this.sitemapUrl, childUrl)) {
                    this.errors.push(`Skipped external sitemap: ${childUrl}`);
                    continue;
                }

                await this.parseSitemapRecursive(childUrl, depth + 1);
            }
        } else {
            const urls = parseStandardSitemap(xml);

            for (const parsedUrl of urls) {
                if (this.collectedUrls.length >= this.maxUrls) {
                    break;
                }

                if (!validateDomain(this.sitemapUrl, parsedUrl.loc)) {
                    continue;
                }

                this.collectedUrls.push(parsedUrl);
            }
        }
    }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/sitemaps/parse
 * Parse a sitemap URL and return discovered URLs
 * Requirements: 6.2, 6.4
 */
sitemapRoutes.post('/parse', async (request, response) => {
    try {
        const body = request.body as SitemapParseRequest;

        // Validate sitemap URL
        const validation = validateSitemapUrl(body.sitemapUrl);
        if (!validation.valid) {
            response.status(400).json({
                code: 'VALIDATION_ERROR',
                message: validation.error,
            });
            return;
        }

        // Parse sitemap
        const maxUrls = body.maxUrls ?? DEFAULT_MAX_URLS;
        const parser = new SitemapParser(body.sitemapUrl, maxUrls);

        const result = await parser.parse();

        if (result.urls.length === 0 && result.errors.length > 0) {
            response.status(400).json({
                code: 'PARSE_ERROR',
                message: result.errors[0],
                errors: result.errors,
            });
            return;
        }

        if (result.urls.length === 0) {
            response.status(400).json({
                code: 'EMPTY_SITEMAP',
                message: 'No URLs found in sitemap',
            });
            return;
        }

        response.json(result);
    } catch (error) {
        console.error('Sitemap parsing error:', error);
        response.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Failed to parse sitemap',
        });
    }
});
