/**
 * Unit Tests for RollbackManager
 *
 * Tests snapshot saving, retrieval, and rollback operations.
 * Improves coverage for rollback-manager.ts.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RollbackManager, rollbackManager, type DOMSnapshot } from '../services/rollback-manager.js';
import type { Page, ElementHandle } from 'playwright';

describe('RollbackManager', () => {
    let manager: RollbackManager;
    const sessionId = 'test-session-123';

    beforeEach(() => {
        manager = new RollbackManager();
    });

    describe('saveSnapshot()', () => {
        it('should save snapshot and return ID', () => {
            const snapshotId = manager.saveSnapshot(
                sessionId,
                '#element',
                '<div id="element">Content</div>'
            );

            expect(snapshotId).toBeDefined();
            expect(snapshotId).toMatch(/^snapshot-/);
        });

        it('should generate unique IDs for each snapshot', () => {
            const id1 = manager.saveSnapshot(sessionId, '#el1', '<div>1</div>');
            const id2 = manager.saveSnapshot(sessionId, '#el2', '<div>2</div>');
            const id3 = manager.saveSnapshot(sessionId, '#el3', '<div>3</div>');

            expect(id1).not.toBe(id2);
            expect(id2).not.toBe(id3);
            expect(id1).not.toBe(id3);
        });

        it('should store snapshot data correctly', () => {
            const selector = '#test-element';
            const html = '<div id="test-element">Test Content</div>';

            const snapshotId = manager.saveSnapshot(sessionId, selector, html);
            const snapshot = manager.getSnapshot(snapshotId);

            expect(snapshot).toBeDefined();
            expect(snapshot?.id).toBe(snapshotId);
            expect(snapshot?.selector).toBe(selector);
            expect(snapshot?.html).toBe(html);
            expect(snapshot?.sessionId).toBe(sessionId);
            expect(snapshot?.timestamp).toBeDefined();
        });

        it('should track snapshots by session', () => {
            manager.saveSnapshot(sessionId, '#el1', '<div>1</div>');
            manager.saveSnapshot(sessionId, '#el2', '<div>2</div>');
            manager.saveSnapshot('other-session', '#el3', '<div>3</div>');

            expect(manager.getSnapshotCount(sessionId)).toBe(2);
            expect(manager.getSnapshotCount('other-session')).toBe(1);
        });
    });

    describe('getSnapshot()', () => {
        it('should return snapshot by ID', () => {
            const snapshotId = manager.saveSnapshot(sessionId, '#el', '<div>Content</div>');
            const snapshot = manager.getSnapshot(snapshotId);

            expect(snapshot).toBeDefined();
            expect(snapshot?.id).toBe(snapshotId);
        });

        it('should return undefined for non-existent ID', () => {
            const snapshot = manager.getSnapshot('non-existent-id');
            expect(snapshot).toBeUndefined();
        });
    });

    describe('getSessionSnapshots()', () => {
        it('should return all snapshots for a session', () => {
            const id1 = manager.saveSnapshot(sessionId, '#el1', '<div>1</div>');
            const id2 = manager.saveSnapshot(sessionId, '#el2', '<div>2</div>');

            const snapshots = manager.getSessionSnapshots(sessionId);

            expect(snapshots).toHaveLength(2);
            expect(snapshots.map(s => s.id)).toContain(id1);
            expect(snapshots.map(s => s.id)).toContain(id2);
        });

        it('should return empty array for session with no snapshots', () => {
            const snapshots = manager.getSessionSnapshots('non-existent-session');
            expect(snapshots).toEqual([]);
        });

        it('should not include snapshots from other sessions', () => {
            manager.saveSnapshot(sessionId, '#el1', '<div>1</div>');
            manager.saveSnapshot('other-session', '#el2', '<div>2</div>');

            const snapshots = manager.getSessionSnapshots(sessionId);
            expect(snapshots).toHaveLength(1);
            expect(snapshots[0].selector).toBe('#el1');
        });
    });

    describe('rollback()', () => {
        it('should restore element HTML from snapshot', async () => {
            const snapshotId = manager.saveSnapshot(
                sessionId,
                '#element',
                '<div id="element">Original</div>'
            );

            const mockEvaluate = vi.fn();
            const mockElement = { evaluate: mockEvaluate } as unknown as ElementHandle;
            const mockPage = {
                $: vi.fn().mockResolvedValue(mockElement)
            } as unknown as Page;

            await manager.rollback(mockPage, snapshotId);

            expect(mockPage.$).toHaveBeenCalledWith('#element');
            expect(mockEvaluate).toHaveBeenCalledWith(
                expect.any(Function),
                '<div id="element">Original</div>'
            );
        });

        it('should throw error for non-existent snapshot', async () => {
            const mockPage = {} as Page;

            await expect(manager.rollback(mockPage, 'non-existent')).rejects.toThrow(
                'Snapshot not found: non-existent'
            );
        });

        it('should throw error when element is not found', async () => {
            const snapshotId = manager.saveSnapshot(sessionId, '#missing', '<div>Content</div>');
            const mockPage = {
                $: vi.fn().mockResolvedValue(null)
            } as unknown as Page;

            await expect(manager.rollback(mockPage, snapshotId)).rejects.toThrow(
                'Element not found for rollback: #missing'
            );
        });
    });

    describe('getRollbackHtml()', () => {
        it('should return HTML for snapshot', () => {
            const html = '<div>Original Content</div>';
            const snapshotId = manager.saveSnapshot(sessionId, '#el', html);

            const result = manager.getRollbackHtml(snapshotId);

            expect(result).toBe(html);
        });

        it('should throw error for non-existent snapshot', () => {
            expect(() => manager.getRollbackHtml('non-existent')).toThrow(
                'Snapshot not found: non-existent'
            );
        });
    });

    describe('deleteSnapshot()', () => {
        it('should delete snapshot and return true', () => {
            const snapshotId = manager.saveSnapshot(sessionId, '#el', '<div>Content</div>');

            const result = manager.deleteSnapshot(snapshotId);

            expect(result).toBe(true);
            expect(manager.getSnapshot(snapshotId)).toBeUndefined();
        });

        it('should return false for non-existent snapshot', () => {
            const result = manager.deleteSnapshot('non-existent');
            expect(result).toBe(false);
        });

        it('should remove from session tracking', () => {
            const snapshotId = manager.saveSnapshot(sessionId, '#el', '<div>Content</div>');
            expect(manager.getSnapshotCount(sessionId)).toBe(1);

            manager.deleteSnapshot(snapshotId);

            expect(manager.getSnapshotCount(sessionId)).toBe(0);
        });

        it('should only delete specified snapshot', () => {
            const id1 = manager.saveSnapshot(sessionId, '#el1', '<div>1</div>');
            const id2 = manager.saveSnapshot(sessionId, '#el2', '<div>2</div>');

            manager.deleteSnapshot(id1);

            expect(manager.getSnapshot(id1)).toBeUndefined();
            expect(manager.getSnapshot(id2)).toBeDefined();
            expect(manager.getSnapshotCount(sessionId)).toBe(1);
        });
    });

    describe('clearSession()', () => {
        it('should clear all snapshots for a session', () => {
            manager.saveSnapshot(sessionId, '#el1', '<div>1</div>');
            manager.saveSnapshot(sessionId, '#el2', '<div>2</div>');
            manager.saveSnapshot('other-session', '#el3', '<div>3</div>');

            manager.clearSession(sessionId);

            expect(manager.getSnapshotCount(sessionId)).toBe(0);
            expect(manager.getSnapshotCount('other-session')).toBe(1);
        });

        it('should handle clearing non-existent session', () => {
            expect(() => manager.clearSession('non-existent')).not.toThrow();
        });
    });

    describe('clearAll()', () => {
        it('should clear all snapshots from all sessions', () => {
            manager.saveSnapshot(sessionId, '#el1', '<div>1</div>');
            manager.saveSnapshot('session-2', '#el2', '<div>2</div>');
            manager.saveSnapshot('session-3', '#el3', '<div>3</div>');

            manager.clearAll();

            expect(manager.getTotalSnapshotCount()).toBe(0);
            expect(manager.getSnapshotCount(sessionId)).toBe(0);
            expect(manager.getSnapshotCount('session-2')).toBe(0);
            expect(manager.getSnapshotCount('session-3')).toBe(0);
        });
    });

    describe('getSnapshotCount()', () => {
        it('should return count for session', () => {
            manager.saveSnapshot(sessionId, '#el1', '<div>1</div>');
            manager.saveSnapshot(sessionId, '#el2', '<div>2</div>');

            expect(manager.getSnapshotCount(sessionId)).toBe(2);
        });

        it('should return 0 for session with no snapshots', () => {
            expect(manager.getSnapshotCount('empty-session')).toBe(0);
        });
    });

    describe('getTotalSnapshotCount()', () => {
        it('should return total count across all sessions', () => {
            manager.saveSnapshot(sessionId, '#el1', '<div>1</div>');
            manager.saveSnapshot('session-2', '#el2', '<div>2</div>');
            manager.saveSnapshot('session-3', '#el3', '<div>3</div>');

            expect(manager.getTotalSnapshotCount()).toBe(3);
        });

        it('should return 0 when empty', () => {
            expect(manager.getTotalSnapshotCount()).toBe(0);
        });
    });
});

describe('rollbackManager singleton', () => {
    it('should be a RollbackManager instance', () => {
        expect(rollbackManager).toBeInstanceOf(RollbackManager);
    });
});

