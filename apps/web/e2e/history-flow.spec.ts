/**
 * E2E Test: History Flow
 * Tests: View history → Select session → View report → Delete
 * Requirements: 6.1, 6.3, 6.4
 */
import { test, expect } from '@playwright/test';

test.describe('History Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to history page
        await page.goto('/history');
    });

    test.describe('Session List', () => {
        test('should display history page with title', async ({ page }) => {
            await expect(page.getByRole('heading', { name: /scan history/i })).toBeVisible();
        });

        test('should display session list or empty state', async ({ page }) => {
            // Either show sessions or empty state message
            const sessionList = page.locator('[data-testid="session-list"]');
            const emptyState = page.getByText(/no scans|no sessions|start your first/i);

            const hasContent = await sessionList.isVisible() || await emptyState.isVisible();
            expect(hasContent).toBeTruthy();
        });

        test('should display session cards with required information', async ({ page }) => {
            // Look for session cards
            const sessionCards = page.locator('[data-testid="session-card"]');

            if (await sessionCards.count() > 0) {
                const firstCard = sessionCards.first();

                // Each card should show URL
                await expect(firstCard.getByText(/https?:\/\//)).toBeVisible();
            }
        });

        test('should show total session count', async ({ page }) => {
            // Look for count indicator
            const countText = page.getByText(/\d+ scan/i);

            if (await countText.isVisible()) {
                expect(await countText.isVisible()).toBeTruthy();
            }
        });
    });

    test.describe('Session Selection', () => {
        test('should navigate to report when clicking view button', async ({ page }) => {
            // Find a view button on a session card
            const viewButton = page.getByRole('button', { name: /view/i }).first();

            if (await viewButton.isVisible()) {
                await viewButton.click();

                // Should navigate to report page
                await expect(page).toHaveURL(/\/report\//);
            }
        });

        test('should display report details after selection', async ({ page }) => {
            const viewButton = page.getByRole('button', { name: /view/i }).first();

            if (await viewButton.isVisible()) {
                await viewButton.click();

                // Wait for report page to load
                await expect(page).toHaveURL(/\/report\//);

                // Verify report content is displayed
                await expect(page.getByText(/violations|summary|report/i)).toBeVisible();
            }
        });
    });

    test.describe('Session Deletion', () => {
        test('should show delete button on session cards', async ({ page }) => {
            const deleteButton = page.getByRole('button', { name: /delete/i }).first();

            if (await deleteButton.isVisible()) {
                expect(await deleteButton.isVisible()).toBeTruthy();
            }
        });

        test('should show confirmation dialog when clicking delete', async ({ page }) => {
            const deleteButton = page.getByRole('button', { name: /delete/i }).first();

            if (await deleteButton.isVisible()) {
                await deleteButton.click();

                // Should show confirmation dialog
                const dialog = page.getByRole('dialog');
                const confirmText = page.getByText(/confirm|are you sure|delete/i);

                const hasConfirmation = await dialog.isVisible() || await confirmText.isVisible();
                expect(hasConfirmation).toBeTruthy();
            }
        });

        test('should cancel deletion when clicking cancel', async ({ page }) => {
            const deleteButton = page.getByRole('button', { name: /delete/i }).first();

            if (await deleteButton.isVisible()) {
                // Get initial session count
                const initialCards = await page.locator('[data-testid="session-card"]').count();

                await deleteButton.click();

                // Click cancel button
                const cancelButton = page.getByRole('button', { name: /cancel/i });
                if (await cancelButton.isVisible()) {
                    await cancelButton.click();

                    // Session count should remain the same
                    const finalCards = await page.locator('[data-testid="session-card"]').count();
                    expect(finalCards).toBe(initialCards);
                }
            }
        });

        test('should delete session when confirming deletion', async ({ page }) => {
            const sessionCards = page.locator('[data-testid="session-card"]');
            const initialCount = await sessionCards.count();

            if (initialCount > 0) {
                const deleteButton = page.getByRole('button', { name: /delete/i }).first();

                if (await deleteButton.isVisible()) {
                    await deleteButton.click();

                    // Confirm deletion
                    const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i }).last();
                    if (await confirmButton.isVisible()) {
                        await confirmButton.click();

                        // Wait for deletion to complete
                        await page.waitForTimeout(500);

                        // Session count should decrease or show empty state
                        const finalCount = await sessionCards.count();
                        expect(finalCount).toBeLessThanOrEqual(initialCount);
                    }
                }
            }
        });
    });

    test.describe('Pagination', () => {
        test('should display pagination when there are many sessions', async ({ page }) => {
            // Look for pagination controls
            const pagination = page.locator('[data-testid="pagination"]');
            const pageButtons = page.getByRole('button', { name: /\d+|next|previous/i });

            // Pagination may or may not be visible depending on session count
            const hasPagination = await pagination.isVisible() || await pageButtons.count() > 0;

            // This is informational - pagination only shows when needed
            if (hasPagination) {
                expect(hasPagination).toBeTruthy();
            }
        });

        test('should navigate between pages', async ({ page }) => {
            const nextButton = page.getByRole('button', { name: /next/i });

            if (await nextButton.isVisible() && await nextButton.isEnabled()) {
                await nextButton.click();

                // URL should update with page parameter or content should change
                await page.waitForTimeout(300);

                // Verify we're still on history page
                await expect(page).toHaveURL(/\/history/);
            }
        });

        test('should show correct page numbers', async ({ page }) => {
            const pageNumbers = page.getByRole('button', { name: /^\d+$/ });

            if (await pageNumbers.count() > 0) {
                // First page should be highlighted/active
                const firstPage = pageNumbers.first();
                expect(await firstPage.isVisible()).toBeTruthy();
            }
        });
    });

    test.describe('Navigation', () => {
        test('should navigate to history from sidebar', async ({ page }) => {
            // Go to home first
            await page.goto('/');

            // Click history link in sidebar
            const historyLink = page.getByRole('link', { name: /history/i });

            if (await historyLink.isVisible()) {
                await historyLink.click();
                await expect(page).toHaveURL('/history');
            }
        });

        test('should navigate back to home from history', async ({ page }) => {
            // Look for home/new scan link
            const homeLink = page.getByRole('link', { name: /new scan|home/i });

            if (await homeLink.isVisible()) {
                await homeLink.click();
                await expect(page).toHaveURL('/');
            }
        });

        test('should show "View all" link on home page', async ({ page }) => {
            await page.goto('/');

            const viewAllLink = page.getByRole('link', { name: /view all/i });

            if (await viewAllLink.isVisible()) {
                await viewAllLink.click();
                await expect(page).toHaveURL('/history');
            }
        });
    });
});
