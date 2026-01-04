/**
 * Rollback Manager for DOM Snapshots
 * 
 * Saves DOM snapshots before fixes and supports rollback by snapshot ID.
 * Requirements: 7.3
 */

import type { Page } from 'playwright';
import { randomUUID } from 'crypto';

// ============================================================================
// Snapshot Types
// ============================================================================

export interface DOMSnapshot {
    id: string;
    selector: string;
    html: string;
    timestamp: string;
    sessionId: string;
}

// ============================================================================
// Rollback Manager Class
// ============================================================================

export class RollbackManager {
    private snapshots: Map<string, DOMSnapshot> = new Map();
    private snapshotsBySession: Map<string, string[]> = new Map();

    /**
     * Generates a unique snapshot ID
     */
    private generateSnapshotId(): string {
        return `snapshot-${randomUUID()}`;
    }

    /**
     * Saves a DOM snapshot before applying a fix
     * Requirements: 7.3 - Save DOM snapshots before fixes
     * 
     * @returns The snapshot ID for later rollback
     */
    saveSnapshot(sessionId: string, selector: string, html: string): string {
        const id = this.generateSnapshotId();
        const snapshot: DOMSnapshot = {
            id,
            selector,
            html,
            timestamp: new Date().toISOString(),
            sessionId
        };

        this.snapshots.set(id, snapshot);

        // Track snapshots by session
        const sessionSnapshots = this.snapshotsBySession.get(sessionId) ?? [];
        sessionSnapshots.push(id);
        this.snapshotsBySession.set(sessionId, sessionSnapshots);

        return id;
    }

    /**
     * Gets a snapshot by ID
     */
    getSnapshot(snapshotId: string): DOMSnapshot | undefined {
        return this.snapshots.get(snapshotId);
    }

    /**
     * Gets all snapshots for a session
     */
    getSessionSnapshots(sessionId: string): DOMSnapshot[] {
        const snapshotIds = this.snapshotsBySession.get(sessionId) ?? [];
        return snapshotIds
            .map(id => this.snapshots.get(id))
            .filter((s): s is DOMSnapshot => s !== undefined);
    }

    /**
     * Rolls back a fix by restoring the DOM from a snapshot
     * Requirements: 7.3 - Implement rollback by snapshot ID
     * 
     * @param page - Playwright page instance
     * @param snapshotId - The ID of the snapshot to restore
     * @throws Error if snapshot not found or rollback fails
     */
    async rollback(page: Page, snapshotId: string): Promise<void> {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            throw new Error(`Snapshot not found: ${snapshotId}`);
        }

        const { selector, html } = snapshot;

        // Find the element and restore its HTML
        const element = await page.$(selector);
        if (!element) {
            throw new Error(`Element not found for rollback: ${selector}`);
        }

        // Replace the element's outer HTML with the snapshot
        await element.evaluate((el: Element, originalHtml: string) => {
            el.outerHTML = originalHtml;
        }, html);
    }

    /**
     * Rolls back to a snapshot without requiring a page (returns the HTML to restore)
     * Useful for testing or when the page is not available
     */
    getRollbackHtml(snapshotId: string): string {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            throw new Error(`Snapshot not found: ${snapshotId}`);
        }
        return snapshot.html;
    }

    /**
     * Deletes a snapshot
     */
    deleteSnapshot(snapshotId: string): boolean {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            return false;
        }

        // Remove from session tracking
        const sessionSnapshots = this.snapshotsBySession.get(snapshot.sessionId);
        if (sessionSnapshots) {
            const index = sessionSnapshots.indexOf(snapshotId);
            if (index > -1) {
                sessionSnapshots.splice(index, 1);
            }
        }

        return this.snapshots.delete(snapshotId);
    }

    /**
     * Clears all snapshots for a session
     */
    clearSession(sessionId: string): void {
        const snapshotIds = this.snapshotsBySession.get(sessionId) ?? [];
        for (const id of snapshotIds) {
            this.snapshots.delete(id);
        }
        this.snapshotsBySession.delete(sessionId);
    }

    /**
     * Clears all snapshots
     */
    clearAll(): void {
        this.snapshots.clear();
        this.snapshotsBySession.clear();
    }

    /**
     * Gets the count of snapshots for a session
     */
    getSnapshotCount(sessionId: string): number {
        return this.snapshotsBySession.get(sessionId)?.length ?? 0;
    }

    /**
     * Gets the total count of all snapshots
     */
    getTotalSnapshotCount(): number {
        return this.snapshots.size;
    }
}

/**
 * Singleton instance for convenience
 */
export const rollbackManager = new RollbackManager();
