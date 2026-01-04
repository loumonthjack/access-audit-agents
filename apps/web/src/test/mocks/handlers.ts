/**
 * MSW handlers for mocking API endpoints and WebSocket events
 * Requirements: (testing)
 */
import { http, HttpResponse, delay } from 'msw';
import type { ScanSession, RemediationReport, Violation, AppliedFix } from '@/types/domain';
import type { PaginatedResponse } from '@/types/api';

// Base API URL for handlers - matches the default development API URL
const API_BASE = 'http://localhost:3001/api';

// Also handle AWS API Gateway URLs for integration tests
const AWS_API_BASE = 'https://qup2m3qa03.execute-api.us-east-1.amazonaws.com/development';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create a mock scan session
 */
export function createMockSession(overrides: Partial<ScanSession> = {}): ScanSession {
  return {
    id: 'session-123',
    url: 'https://example.com',
    viewport: 'desktop',
    status: 'complete',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    violationCounts: {
      total: 5,
      critical: 1,
      serious: 2,
      moderate: 1,
      minor: 1,
    },
    fixCounts: {
      fixed: 3,
      skipped: 1,
      pending: 1,
    },
    ...overrides,
  };
}

/**
 * Create a mock violation
 */
export function createMockViolation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: 'violation-1',
    ruleId: 'image-alt',
    impact: 'critical',
    description: 'Images must have alternate text',
    help: 'Ensures <img> elements have alternate text or a role of none or presentation',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/image-alt',
    selector: 'img.hero-image',
    html: '<img src="hero.jpg" class="hero-image">',
    status: 'pending',
    ...overrides,
  };
}

/**
 * Create a mock applied fix
 */
export function createMockFix(overrides: Partial<AppliedFix> = {}): AppliedFix {
  return {
    violationId: 'violation-1',
    fixType: 'attribute',
    beforeHtml: '<img src="hero.jpg" class="hero-image">',
    afterHtml: '<img src="hero.jpg" class="hero-image" alt="Hero banner image">',
    reasoning: 'Added descriptive alt text to convey the image content to screen reader users.',
    appliedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * API response shape that the backend returns (before transformation)
 */
interface ApiReportViolation {
  id: string;
  ruleId: string;
  impact: string;
  description: string;
  selector: string;
  html: string;
  status: 'pending' | 'processing' | 'fixed' | 'skipped';
  skipReason?: string;
  fix?: {
    type: string;
    beforeHtml: string;
    afterHtml: string;
    reasoning: string;
  };
}

interface ApiReportResponse {
  id: string;
  url: string;
  viewport: 'mobile' | 'desktop';
  status: string;
  createdAt: string;
  completedAt?: string;
  violations: ApiReportViolation[];
  summary: {
    totalViolations: number;
    fixedCount: number;
    skippedCount: number;
  };
}

/**
 * Create a mock API report response (in the format the backend returns)
 */
export function createMockApiReport(sessionId: string = 'session-123'): ApiReportResponse {
  return {
    id: sessionId,
    url: 'https://example.com',
    viewport: 'desktop',
    status: 'complete',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    violations: [
      {
        id: 'violation-1',
        ruleId: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text',
        selector: 'img.hero-image',
        html: '<img src="hero.jpg" class="hero-image">',
        status: 'fixed',
        fix: {
          type: 'attribute',
          beforeHtml: '<img src="hero.jpg" class="hero-image">',
          afterHtml: '<img src="hero.jpg" class="hero-image" alt="Hero banner image">',
          reasoning:
            'Added descriptive alt text to convey the image content to screen reader users.',
        },
      },
      {
        id: 'violation-2',
        ruleId: 'color-contrast',
        impact: 'serious',
        description: 'Elements must have sufficient color contrast',
        selector: '.low-contrast-text',
        html: '<span class="low-contrast-text">Some text</span>',
        status: 'skipped',
        skipReason: 'Unable to determine appropriate contrast ratio without design context',
      },
      {
        id: 'violation-3',
        ruleId: 'link-name',
        impact: 'moderate',
        description: 'Links must have discernible text',
        selector: 'a.icon-link',
        html: '<a class="icon-link" href="/page"></a>',
        status: 'pending',
      },
    ],
    summary: {
      totalViolations: 3,
      fixedCount: 1,
      skippedCount: 1,
    },
  };
}

/**
 * Create a mock remediation report (transformed format for client-side use)
 */
export function createMockReport(overrides: Partial<RemediationReport> = {}): RemediationReport {
  return {
    sessionId: 'session-123',
    url: 'https://example.com',
    viewport: 'desktop',
    timestamp: new Date().toISOString(),
    duration: 45000,
    summary: {
      totalViolations: 5,
      fixedCount: 3,
      skippedCount: 1,
      humanReviewCount: 1,
    },
    fixes: [createMockFix()],
    skipped: [
      {
        violationId: 'violation-2',
        ruleId: 'color-contrast',
        selector: '.low-contrast-text',
        reason: 'Unable to determine appropriate contrast ratio without design context',
        attempts: 2,
      },
    ],
    humanReview: [
      {
        violationId: 'violation-3',
        ruleId: 'link-name',
        selector: 'a.icon-link',
        reason: 'Link purpose unclear without surrounding context',
        suggestedAction: 'Add aria-label or visible text to describe link destination',
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// Mock Data Store (for stateful tests)
// ============================================================================

let mockSessions: ScanSession[] = [
  createMockSession({ id: 'session-1', url: 'https://example.com' }),
  createMockSession({ id: 'session-2', url: 'https://test.com', status: 'scanning' }),
  createMockSession({ id: 'session-3', url: 'https://demo.com' }),
];

let mockApiReports: Map<string, ApiReportResponse> = new Map([
  ['session-1', createMockApiReport('session-1')],
  ['session-3', createMockApiReport('session-3')],
]);

/**
 * Reset mock data to initial state (call in beforeEach)
 */
export function resetMockData(): void {
  mockSessions = [
    createMockSession({ id: 'session-1', url: 'https://example.com' }),
    createMockSession({ id: 'session-2', url: 'https://test.com', status: 'scanning' }),
    createMockSession({ id: 'session-3', url: 'https://demo.com' }),
  ];
  mockApiReports = new Map([
    ['session-1', createMockApiReport('session-1')],
    ['session-3', createMockApiReport('session-3')],
  ]);
}

/**
 * Get current mock sessions (for test assertions)
 */
export function getMockSessions(): ScanSession[] {
  return [...mockSessions];
}

/**
 * Add a mock session (for test setup)
 */
export function addMockSession(session: ScanSession): void {
  mockSessions.push(session);
}

// ============================================================================
// API Handlers
// ============================================================================

// Helper to create handlers for both local and AWS API URLs
const createApiHandlers = (baseUrl: string) => [
  // Health check
  http.get(`${baseUrl}/health`, () => {
    return HttpResponse.json({ status: 'ok' });
  }),

  // ========================================================================
  // Scan API Handlers (Requirements: 1.1)
  // ========================================================================

  // Start a new scan
  http.post(`${baseUrl}/scans`, async ({ request }) => {
    await delay(100); // Simulate network latency

    const body = (await request.json()) as { url: string; viewport: 'mobile' | 'desktop' };

    // Validate URL
    try {
      new URL(body.url);
    } catch {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const newSession = createMockSession({
      id: `session-${Date.now()}`,
      url: body.url,
      viewport: body.viewport,
      status: 'scanning',
      completedAt: undefined,
    });

    mockSessions.unshift(newSession);
    return HttpResponse.json(newSession, { status: 201 });
  }),

  // Get a scan session by ID
  http.get(`${baseUrl}/scans/:sessionId`, async ({ params }) => {
    await delay(50);

    const { sessionId } = params;
    const session = mockSessions.find((s) => s.id === sessionId);

    if (!session) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Session not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json(session);
  }),

  // ========================================================================
  // History API Handlers (Requirements: 6.1, 6.4, 6.5)
  // ========================================================================

  // List sessions with pagination
  http.get(`${baseUrl}/sessions`, async ({ request }) => {
    await delay(50);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedSessions = mockSessions.slice(start, end);

    const response: PaginatedResponse<ScanSession> = {
      data: paginatedSessions,
      pagination: {
        page,
        limit,
        total: mockSessions.length,
        totalPages: Math.ceil(mockSessions.length / limit),
      },
    };

    return HttpResponse.json(response);
  }),

  // Delete a session
  http.delete(`${baseUrl}/sessions/:sessionId`, async ({ params }) => {
    await delay(50);

    const { sessionId } = params;
    const index = mockSessions.findIndex((s) => s.id === sessionId);

    if (index === -1) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: 'Session not found' },
        { status: 404 }
      );
    }

    mockSessions.splice(index, 1);
    mockApiReports.delete(sessionId as string);

    return new HttpResponse(null, { status: 204 });
  }),

  // ========================================================================
  // Report API Handlers (Requirements: 5.1, 5.5)
  // ========================================================================

  // Get a report by session ID
  http.get(`${baseUrl}/reports/:sessionId`, async ({ params }) => {
    await delay(50);

    const { sessionId } = params;
    const report = mockApiReports.get(sessionId as string);

    if (!report) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Report not found' }, { status: 404 });
    }

    return HttpResponse.json(report);
  }),

  // Export a report
  http.get(`${baseUrl}/reports/:sessionId/export`, async ({ params, request }) => {
    await delay(100);

    const { sessionId } = params;
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    const report = mockApiReports.get(sessionId as string);

    if (!report) {
      return HttpResponse.json({ code: 'NOT_FOUND', message: 'Report not found' }, { status: 404 });
    }

    if (format === 'json') {
      return HttpResponse.json(report, {
        headers: {
          'Content-Disposition': `attachment; filename="report-${sessionId}.json"`,
        },
      });
    }

    // HTML format
    const htmlContent = `
<!DOCTYPE html>
<html>
<head><title>Accessibility Report - ${report.url}</title></head>
<body>
<h1>Accessibility Report</h1>
<p>URL: ${report.url}</p>
<p>Total Violations: ${report.summary.totalViolations}</p>
<p>Fixed: ${report.summary.fixedCount}</p>
<p>Skipped: ${report.summary.skippedCount}</p>
</body>
</html>`;

    return new HttpResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="report-${sessionId}.html"`,
      },
    });
  }),

  // ========================================================================
  // Auth API Handlers (Requirements: 7.1, 7.2, 8.1)
  // ========================================================================

  // Login with credentials
  http.post(`${baseUrl}/auth/login`, async ({ request }) => {
    await delay(100);

    const body = (await request.json()) as { email: string; password: string };

    // Simple validation
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Mock invalid credentials
    if (body.password === 'wrong-password') {
      return HttpResponse.json(
        { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      user: {
        id: 'user-1',
        email: body.email,
        name: 'Test User',
        authProvider: 'local',
      },
      token: 'mock-jwt-token',
    });
  }),

  // Get current user
  http.get(`${baseUrl}/auth/me`, async ({ request }) => {
    await delay(50);

    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    if (token === 'invalid-token') {
      return HttpResponse.json({ code: 'UNAUTHORIZED', message: 'Invalid token' }, { status: 401 });
    }

    return HttpResponse.json({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      authProvider: 'local',
    });
  }),

  // Logout
  http.post(`${baseUrl}/auth/logout`, async () => {
    await delay(50);
    return new HttpResponse(null, { status: 204 });
  }),
];

// Create handlers for both local and AWS API URLs
export const handlers = [...createApiHandlers(API_BASE), ...createApiHandlers(AWS_API_BASE)];

// ============================================================================
// WebSocket Mock Utilities
// ============================================================================

/**
 * Mock WebSocket event emitter for testing real-time updates
 */
export class MockWebSocketServer {
  private listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();

  /**
   * Register a listener for a session
   */
  addListener(sessionId: string, listener: (event: MessageEvent) => void): void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)!.add(listener);
  }

  /**
   * Remove a listener for a session
   */
  removeListener(sessionId: string, listener: (event: MessageEvent) => void): void {
    this.listeners.get(sessionId)?.delete(listener);
  }

  /**
   * Emit an event to all listeners for a session
   */
  emit(sessionId: string, event: unknown): void {
    const sessionListeners = this.listeners.get(sessionId);
    if (sessionListeners) {
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify(event),
      });
      sessionListeners.forEach((listener) => listener(messageEvent));
    }
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Global mock WebSocket server instance
 */
export const mockWsServer = new MockWebSocketServer();

/**
 * Helper to emit a sequence of WebSocket events with delays
 */
export async function emitEventSequence(
  sessionId: string,
  events: Array<{ event: unknown; delay?: number }>
): Promise<void> {
  for (const { event, delay: eventDelay = 100 } of events) {
    await new Promise((resolve) => setTimeout(resolve, eventDelay));
    mockWsServer.emit(sessionId, event);
  }
}
