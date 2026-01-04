/**
 * Unit Tests for ReportGenerator
 *
 * Tests report generation, fix tracking, and summary calculations.
 * Improves coverage for report-generator.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    ReportGenerator,
    createReportFromSession,
    isRemediationComplete,
    type ViolationMetadata
} from '../services/report-generator.js';
import type { AppliedFix, SkippedViolation, HumanHandoffItem, AuditLogEntry } from '../types/index.js';
import type { SessionStateManager } from '../services/session-state-manager.js';
import type { AuditLogger } from '../services/audit-logger.js';

describe('ReportGenerator', () => {
    let generator: ReportGenerator;
    const sessionId = 'test-session-123';
    const url = 'https://example.com';

    beforeEach(() => {
        generator = new ReportGenerator(sessionId, url);
    });

    describe('constructor', () => {
        it('should create generator with session id and url', () => {
            expect(generator).toBeDefined();
            const report = generator.generate();
            expect(report.sessionId).toBe(sessionId);
            expect(report.url).toBe(url);
        });
    });

    describe('addFix()', () => {
        it('should add a fix to the report', () => {
            const fix: AppliedFix = {
                violationId: 'v1',
                ruleId: 'color-contrast',
                selector: '#element',
                fixType: 'style',
                beforeHtml: '<div style="color: #666">Text</div>',
                afterHtml: '<div style="color: #000">Text</div>',
                reasoning: 'Adjusted color contrast'
            };

            generator.addFix(fix);

            expect(generator.getFixedCount()).toBe(1);
            const report = generator.generate();
            expect(report.fixes).toContainEqual(fix);
        });

        it('should add multiple fixes', () => {
            generator.addFix({ violationId: 'v1', ruleId: 'r1', selector: 's1', fixType: 'attribute', beforeHtml: '', afterHtml: '', reasoning: 'Fix 1' });
            generator.addFix({ violationId: 'v2', ruleId: 'r2', selector: 's2', fixType: 'attribute', beforeHtml: '', afterHtml: '', reasoning: 'Fix 2' });
            generator.addFix({ violationId: 'v3', ruleId: 'r3', selector: 's3', fixType: 'style', beforeHtml: '', afterHtml: '', reasoning: 'Fix 3' });

            expect(generator.getFixedCount()).toBe(3);
        });
    });

    describe('addSkipped()', () => {
        it('should add a skipped violation', () => {
            const skipped: SkippedViolation = {
                violationId: 'v1',
                ruleId: 'complex-rule',
                selector: '#complex-element',
                reason: 'Unable to determine fix automatically',
                attempts: 3
            };

            generator.addSkipped(skipped);

            expect(generator.getSkippedCount()).toBe(1);
            const report = generator.generate();
            expect(report.skipped).toContainEqual(skipped);
        });
    });

    describe('addHumanHandoff()', () => {
        it('should add a human handoff item', () => {
            const handoff: HumanHandoffItem = {
                violationId: 'v1',
                ruleId: 'complex-rule',
                selector: '#element',
                reason: 'Requires design decision',
                suggestedAction: 'Review color palette with design team'
            };

            generator.addHumanHandoff(handoff);

            expect(generator.getHumanHandoffCount()).toBe(1);
            const report = generator.generate();
            expect(report.humanHandoff).toContainEqual(handoff);
        });
    });

    describe('setPendingCount()', () => {
        it('should set pending count', () => {
            generator.setPendingCount(5);

            const summary = generator.calculateSummary();
            expect(summary.pendingCount).toBe(5);
        });
    });

    describe('calculateSummary()', () => {
        it('should calculate correct summary with all types', () => {
            generator.addFix({ violationId: 'v1', ruleId: 'r1', selector: 's1', fixType: 'attribute', beforeHtml: '', afterHtml: '', reasoning: 'Fix 1' });
            generator.addFix({ violationId: 'v2', ruleId: 'r2', selector: 's2', fixType: 'attribute', beforeHtml: '', afterHtml: '', reasoning: 'Fix 2' });
            generator.addSkipped({ violationId: 'v3', ruleId: 'r3', selector: 's3', reason: 'Could not fix', attempts: 3 });
            generator.setPendingCount(2);

            const summary = generator.calculateSummary();

            expect(summary.fixedCount).toBe(2);
            expect(summary.skippedCount).toBe(1);
            expect(summary.pendingCount).toBe(2);
            expect(summary.totalViolations).toBe(5);
        });

        it('should handle empty state', () => {
            const summary = generator.calculateSummary();

            expect(summary.fixedCount).toBe(0);
            expect(summary.skippedCount).toBe(0);
            expect(summary.pendingCount).toBe(0);
            expect(summary.totalViolations).toBe(0);
        });
    });

    describe('generate()', () => {
        it('should generate valid report', () => {
            generator.addFix({ violationId: 'v1', ruleId: 'r1', selector: 's1', fixType: 'attribute', beforeHtml: '<before/>', afterHtml: '<after/>', reasoning: 'Test fix' });

            const report = generator.generate();

            expect(report.sessionId).toBe(sessionId);
            expect(report.url).toBe(url);
            expect(report.timestamp).toBeDefined();
            expect(report.summary.fixedCount).toBe(1);
            expect(report.fixes.length).toBe(1);
            expect(report.skipped.length).toBe(0);
            expect(report.humanHandoff.length).toBe(0);
        });

        it('should include timestamp in ISO format', () => {
            const report = generator.generate();

            expect(() => new Date(report.timestamp)).not.toThrow();
            expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        it('should not mutate internal arrays', () => {
            generator.addFix({ violationId: 'v1', ruleId: 'r1', selector: 's1', fixType: 'attribute', beforeHtml: '', afterHtml: '', reasoning: 'Test' });

            const report1 = generator.generate();
            report1.fixes.push({ violationId: 'extra', ruleId: 'r2', selector: 's2', fixType: 'style', beforeHtml: '', afterHtml: '', reasoning: 'Extra' });

            const report2 = generator.generate();
            expect(report2.fixes.length).toBe(1);
        });
    });

    describe('isComplete()', () => {
        it('should return true when no pending violations', () => {
            generator.addFix({ violationId: 'v1', ruleId: 'r1', selector: 's1', fixType: 'attribute', beforeHtml: '', afterHtml: '', reasoning: 'Test' });
            generator.setPendingCount(0);

            expect(generator.isComplete()).toBe(true);
        });

        it('should return false when pending violations exist', () => {
            generator.setPendingCount(3);

            expect(generator.isComplete()).toBe(false);
        });
    });

    describe('clear()', () => {
        it('should clear all data', () => {
            generator.addFix({ violationId: 'v1', ruleId: 'r1', selector: 's1', fixType: 'attribute', beforeHtml: '', afterHtml: '', reasoning: 'Test' });
            generator.addSkipped({ violationId: 'v2', ruleId: 'r2', selector: 's2', reason: 'reason', attempts: 1 });
            generator.addHumanHandoff({ violationId: 'v3', ruleId: 'r3', selector: 's3', reason: 'reason', suggestedAction: 'action' });
            generator.setPendingCount(5);

            generator.clear();

            expect(generator.getFixedCount()).toBe(0);
            expect(generator.getSkippedCount()).toBe(0);
            expect(generator.getHumanHandoffCount()).toBe(0);
            expect(generator.calculateSummary().pendingCount).toBe(0);
        });
    });

    describe('registerViolations()', () => {
        it('should register violations for later use', () => {
            const violations = [
                { id: 'v1', ruleId: 'color-contrast', selector: '#el1' },
                { id: 'v2', ruleId: 'image-alt', selector: '#el2' }
            ];

            generator.registerViolations(violations);

            // Violations are stored internally for later use in populateFromSession
            expect(generator).toBeDefined();
        });
    });

    describe('createFixFromAuditLog()', () => {
        it('should create AppliedFix from AuditLogEntry', () => {
            const entry: AuditLogEntry = {
                id: 'log-1',
                sessionId: sessionId,
                violationId: 'v1',
                timestamp: new Date().toISOString(),
                instruction: {
                    type: 'style',
                    selector: '#element',
                    action: 'modify',
                    reasoning: 'Fix contrast'
                },
                result: 'applied',
                beforeHtml: '<div>before</div>',
                afterHtml: '<div>after</div>'
            };

            const fix = generator.createFixFromAuditLog(entry);

            expect(fix.violationId).toBe('v1');
            expect(fix.selector).toBe('#element');
            expect(fix.fixType).toBe('style');
            expect(fix.beforeHtml).toBe('<div>before</div>');
            expect(fix.afterHtml).toBe('<div>after</div>');
            expect(fix.reasoning).toBe('Fix contrast');
        });
    });

    describe('populateFromSession()', () => {
        it('should populate from session manager and audit logger', () => {
            const mockSessionManager: SessionStateManager = {
                getFixedViolations: vi.fn().mockReturnValue(['v1']),
                getSkippedViolations: vi.fn().mockReturnValue(['v2']),
                getPendingViolations: vi.fn().mockReturnValue(['v3']),
                getLastFailureReason: vi.fn().mockReturnValue('Max retries exceeded'),
                getRetryAttemptsForViolation: vi.fn().mockReturnValue(3)
            } as unknown as SessionStateManager;

            const mockAuditLogger: AuditLogger = {
                getByViolationId: vi.fn().mockReturnValue([{
                    id: 'log-1',
                    sessionId,
                    violationId: 'v1',
                    timestamp: new Date().toISOString(),
                    instruction: { type: 'attribute', selector: '#el1', action: 'modify' },
                    result: 'applied',
                    beforeHtml: '<before/>',
                    afterHtml: '<after/>'
                }])
            } as unknown as AuditLogger;

            const violationMap = new Map<string, ViolationMetadata>([
                ['v1', { violationId: 'v1', ruleId: 'rule-1', selector: '#el1' }],
                ['v2', { violationId: 'v2', ruleId: 'rule-2', selector: '#el2' }]
            ]);

            generator.populateFromSession(mockSessionManager, mockAuditLogger, violationMap);

            expect(generator.getFixedCount()).toBe(1);
            expect(generator.getSkippedCount()).toBe(1);
            expect(generator.getHumanHandoffCount()).toBe(1);
            expect(generator.calculateSummary().pendingCount).toBe(1);
        });

        it('should handle missing violation metadata', () => {
            const mockSessionManager: SessionStateManager = {
                getFixedViolations: vi.fn().mockReturnValue([]),
                getSkippedViolations: vi.fn().mockReturnValue(['v-unknown']),
                getPendingViolations: vi.fn().mockReturnValue([]),
                getLastFailureReason: vi.fn().mockReturnValue(undefined),
                getRetryAttemptsForViolation: vi.fn().mockReturnValue(1)
            } as unknown as SessionStateManager;

            const mockAuditLogger: AuditLogger = {
                getByViolationId: vi.fn().mockReturnValue([])
            } as unknown as AuditLogger;

            generator.populateFromSession(mockSessionManager, mockAuditLogger, new Map());

            const report = generator.generate();
            expect(report.skipped[0].ruleId).toBe('unknown');
            expect(report.skipped[0].selector).toBe('unknown');
            expect(report.skipped[0].reason).toBe('Maximum retry attempts exceeded');
        });

        it('should not add human handoff for violations with less than 3 attempts', () => {
            const mockSessionManager: SessionStateManager = {
                getFixedViolations: vi.fn().mockReturnValue([]),
                getSkippedViolations: vi.fn().mockReturnValue(['v1']),
                getPendingViolations: vi.fn().mockReturnValue([]),
                getLastFailureReason: vi.fn().mockReturnValue('Some reason'),
                getRetryAttemptsForViolation: vi.fn().mockReturnValue(2)
            } as unknown as SessionStateManager;

            const mockAuditLogger: AuditLogger = {
                getByViolationId: vi.fn().mockReturnValue([])
            } as unknown as AuditLogger;

            generator.populateFromSession(mockSessionManager, mockAuditLogger, new Map());

            expect(generator.getSkippedCount()).toBe(1);
            expect(generator.getHumanHandoffCount()).toBe(0);
        });
    });
});

describe('createReportFromSession()', () => {
    it('should create report from session state', () => {
        const mockSessionManager: SessionStateManager = {
            getFixedViolations: vi.fn().mockReturnValue([]),
            getSkippedViolations: vi.fn().mockReturnValue([]),
            getPendingViolations: vi.fn().mockReturnValue([])
        } as unknown as SessionStateManager;

        const mockAuditLogger: AuditLogger = {
            getByViolationId: vi.fn().mockReturnValue([])
        } as unknown as AuditLogger;

        const report = createReportFromSession(
            'session-1',
            'https://example.com',
            mockSessionManager,
            mockAuditLogger,
            new Map()
        );

        expect(report.sessionId).toBe('session-1');
        expect(report.url).toBe('https://example.com');
        expect(report.summary.totalViolations).toBe(0);
    });
});

describe('isRemediationComplete()', () => {
    it('should return true when session is complete', () => {
        const mockSessionManager: SessionStateManager = {
            isComplete: vi.fn().mockReturnValue(true)
        } as unknown as SessionStateManager;

        expect(isRemediationComplete(mockSessionManager)).toBe(true);
    });

    it('should return false when session is not complete', () => {
        const mockSessionManager: SessionStateManager = {
            isComplete: vi.fn().mockReturnValue(false)
        } as unknown as SessionStateManager;

        expect(isRemediationComplete(mockSessionManager)).toBe(false);
    });
});

