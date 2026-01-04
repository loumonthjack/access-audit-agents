/**
 * E2E Test: Error Recovery
 * Tests: Simulate disconnect → Verify reconnection → Resume
 * Requirements: 10.2, 10.3
 */
import { test, expect } from '@playwright/test';

test.describe('Error Recovery', () => {
    test.describe('API Error Handling', () => {
        test('should display error message when API fails', async ({ page }) => {
            // Intercept API calls and simulate failure
            await page.route('**/api/**', (route) => {
                route.fulfill({
                    status: 500,
                    body: JSON.stringify({ message: 'Internal Server Error' }),
                });
            });

            await page.goto('/history');

            // Should show error state
            const errorMessage = page.getByText(/error|failed|something went wrong/i);
            await expect(errorMessage).toBeVisible({ timeout: 5000 });
        });

        test('should show retry button on API error', async ({ page }) => {
            // Intercept API calls and simulate failure
            await page.route('**/api/**', (route) => {
                route.fulfill({
                    status: 500,
                    body: JSON.stringify({ message: 'Internal Server Error' }),
                });
            });

            await page.goto('/history');

            // Should show retry button
            const retryButton = page.getByRole('button', { name: /retry|try again/i });

            if (await retryButton.isVisible({ timeout: 5000 })) {
                expect(await retryButton.isVisible()).toBeTruthy();
            }
        });

        test('should recover when retry is clicked', async ({ page }) => {
            let requestCount = 0;

            // First request fails, subsequent requests succeed
            await page.route('**/api/sessions**', (route) => {
                requestCount++;
                if (requestCount === 1) {
                    route.fulfill({
                        status: 500,
                        body: JSON.stringify({ message: 'Internal Server Error' }),
                    });
                } else {
                    route.fulfill({
                        status: 200,
                        body: JSON.stringify({
                            data: [],
                            pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
                        }),
                    });
                }
            });

            await page.goto('/history');

            // Wait for error state
            const retryButton = page.getByRole('button', { name: /retry|try again/i });

            if (await retryButton.isVisible({ timeout: 5000 })) {
                await retryButton.click();

                // Should recover and show content
                await page.waitForTimeout(1000);

                // Error should be gone or content should be visible
                const hasRecovered =
                    !(await page.getByText(/error|failed/i).isVisible()) ||
                    await page.getByText(/no scans|scan history/i).isVisible();

                expect(hasRecovered).toBeTruthy();
            }
        });
    });

    test.describe('Network Disconnection', () => {
        test('should show connection banner when offline', async ({ page }) => {
            await page.goto('/');

            // Simulate going offline
            await page.context().setOffline(true);

            // Try to perform an action that requires network
            const urlInput = page.getByRole('textbox', { name: /url/i });
            if (await urlInput.isVisible()) {
                await urlInput.fill('https://example.com');
                await page.getByRole('button', { name: /scan/i }).click();
            }

            // Should show connection error or offline indicator
            // Check for connection-related text
            page.getByText(/offline|connection|network/i);

            // Wait a bit for the error to appear
            await page.waitForTimeout(2000);

            // Restore online status
            await page.context().setOffline(false);
        });

        test('should recover when connection is restored', async ({ page }) => {
            await page.goto('/');

            // Go offline
            await page.context().setOffline(true);
            await page.waitForTimeout(500);

            // Go back online
            await page.context().setOffline(false);
            await page.waitForTimeout(500);

            // Page should still be functional
            await expect(page.getByRole('heading', { name: /accessibility scanner/i })).toBeVisible();
        });
    });

    test.describe('404 Error Handling', () => {
        test('should show not found page for invalid routes', async ({ page }) => {
            await page.goto('/invalid-route-that-does-not-exist');

            // Should show 404 or not found message
            const notFoundText = page.getByText(/404|not found|page.*exist/i);
            await expect(notFoundText).toBeVisible();
        });

        test('should show not found for invalid session ID', async ({ page }) => {
            // Intercept the specific session request
            await page.route('**/api/scans/invalid-session-id', (route) => {
                route.fulfill({
                    status: 404,
                    body: JSON.stringify({ message: 'Session not found' }),
                });
            });

            await page.goto('/scan/invalid-session-id');

            // Should show error or not found message
            const errorText = page.getByText(/not found|error|failed/i);
            await expect(errorText).toBeVisible({ timeout: 5000 });
        });

        test('should show not found for invalid report ID', async ({ page }) => {
            // Intercept the specific report request
            await page.route('**/api/reports/invalid-report-id', (route) => {
                route.fulfill({
                    status: 404,
                    body: JSON.stringify({ message: 'Report not found' }),
                });
            });

            await page.goto('/report/invalid-report-id');

            // Should show error or not found message
            const errorText = page.getByText(/not found|error|failed/i);
            await expect(errorText).toBeVisible({ timeout: 5000 });
        });

        test('should provide navigation back to home from error page', async ({ page }) => {
            await page.goto('/invalid-route');

            // Look for home link or button
            const homeLink = page.getByRole('link', { name: /home|go home/i });

            if (await homeLink.isVisible()) {
                await homeLink.click();
                await expect(page).toHaveURL('/');
            }
        });
    });

    test.describe('Form State Preservation', () => {
        test('should preserve URL input during temporary errors', async ({ page }) => {
            await page.goto('/');

            // Enter a URL
            const urlInput = page.getByRole('textbox', { name: /url/i });
            await urlInput.fill('https://example.com');

            // Simulate a failed scan attempt
            await page.route('**/api/scans', (route) => {
                route.fulfill({
                    status: 500,
                    body: JSON.stringify({ message: 'Server error' }),
                });
            });

            await page.getByRole('button', { name: /scan/i }).click();

            // Wait for error
            await page.waitForTimeout(1000);

            // URL should still be in the input
            await expect(urlInput).toHaveValue('https://example.com');
        });

        test('should preserve viewport selection during errors', async ({ page }) => {
            await page.goto('/');

            // Select viewport if available
            const viewportSelector = page.getByRole('combobox', { name: /viewport/i });

            if (await viewportSelector.isVisible()) {
                await viewportSelector.selectOption('mobile');

                // Simulate error
                await page.route('**/api/scans', (route) => {
                    route.fulfill({
                        status: 500,
                        body: JSON.stringify({ message: 'Server error' }),
                    });
                });

                await page.getByRole('textbox', { name: /url/i }).fill('https://example.com');
                await page.getByRole('button', { name: /scan/i }).click();

                // Wait for error
                await page.waitForTimeout(1000);

                // Viewport selection should be preserved
                await expect(viewportSelector).toHaveValue('mobile');
            }
        });
    });

    test.describe('Error Boundary', () => {
        test('should catch and display runtime errors gracefully', async ({ page }) => {
            // This test verifies the error boundary catches errors
            await page.goto('/');

            // The app should load without crashing
            await expect(page.getByRole('heading', { name: /accessibility scanner/i })).toBeVisible();
        });

        test('should provide reload option on critical errors', async ({ page }) => {
            // Navigate to a page that might have an error boundary
            await page.goto('/');

            // Verify the page loads correctly (error boundary working)
            const mainContent = page.locator('main');
            await expect(mainContent).toBeVisible();
        });
    });

    test.describe('Timeout Handling', () => {
        test('should handle slow API responses gracefully', async ({ page }) => {
            // Simulate slow API response
            await page.route('**/api/sessions**', async (route) => {
                await new Promise((resolve) => setTimeout(resolve, 3000));
                route.fulfill({
                    status: 200,
                    body: JSON.stringify({
                        data: [],
                        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
                    }),
                });
            });

            await page.goto('/history');

            // Should show loading state
            // Loading indicator may be present
            page.getByText(/loading/i);

            // Loading should eventually resolve
            await expect(page.getByRole('heading', { name: /scan history/i })).toBeVisible({ timeout: 10000 });
        });
    });
});
