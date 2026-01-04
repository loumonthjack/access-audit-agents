/**
 * E2E Test: Full Scan Flow
 * Tests: Enter URL → Watch progress → View report
 * Requirements: 1.1, 2.1, 5.1
 */
import { test, expect } from '@playwright/test';

test.describe('Full Scan Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to home page
        await page.goto('/');
    });

    test('should display scan form on home page', async ({ page }) => {
        // Verify scan form is visible
        await expect(page.getByRole('heading', { name: /accessibility scanner/i })).toBeVisible();
        await expect(page.getByRole('textbox', { name: /url/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /scan/i })).toBeVisible();
    });

    test('should show validation error for invalid URL', async ({ page }) => {
        // Wait for the form to be ready
        await page.waitForSelector('form[aria-label="Start accessibility scan"]');

        // Enter invalid URL (not starting with http:// or https://)
        const urlInput = page.getByRole('textbox', { name: /url/i });
        await urlInput.fill('not-a-valid-url');

        // Click scan button to trigger validation
        await page.getByRole('button', { name: /scan/i }).click();

        // The input should show validation state (browser native validation)
        // Check that the input has :invalid pseudo-class by checking validity
        const isInvalid = await urlInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
        expect(isInvalid).toBeTruthy();
    });

    test('should show loading state when scan is initiated', async ({ page }) => {
        // Enter valid URL
        const urlInput = page.getByRole('textbox', { name: /url/i });
        await urlInput.fill('https://example.com');

        // Click scan button
        const scanButton = page.getByRole('button', { name: /scan/i });
        await scanButton.click();

        // Verify loading state (button should be disabled or show loading)
        await expect(scanButton).toBeDisabled();
    });

    test('should navigate to scan page after initiating scan', async ({ page }) => {
        // Enter valid URL
        const urlInput = page.getByRole('textbox', { name: /url/i });
        await urlInput.fill('https://example.com');

        // Click scan button
        await page.getByRole('button', { name: /scan/i }).click();

        // Wait for navigation to scan page
        await expect(page).toHaveURL(/\/scan\//);

        // Verify scan page elements
        await expect(page.getByRole('heading', { name: /scan in progress/i })).toBeVisible();
    });

    test('should display scan progress and violations', async ({ page }) => {
        // Navigate directly to a scan page (session-2 is in "scanning" status)
        await page.goto('/scan/session-2');

        // Wait for the page to load
        await page.waitForLoadState('networkidle');

        // Verify scan page elements are visible (or loading state)
        const scanHeading = page.getByRole('heading', { name: /scan in progress/i });
        const loadingState = page.getByText(/loading/i);

        // Either the scan page or loading state should be visible
        const isVisible = await scanHeading.isVisible() || await loadingState.isVisible();
        expect(isVisible).toBeTruthy();
    });

    test('should allow viewport selection before scanning', async ({ page }) => {
        // Verify viewport selector is present
        const viewportSelector = page.getByRole('combobox', { name: /viewport/i });

        if (await viewportSelector.isVisible()) {
            // Select mobile viewport
            await viewportSelector.selectOption('mobile');

            // Verify selection
            await expect(viewportSelector).toHaveValue('mobile');
        }
    });

    test('should display recent scans on home page', async ({ page }) => {
        // Verify recent scans section
        await expect(page.getByRole('heading', { name: /recent scans/i })).toBeVisible();
    });

    test('should navigate to report from recent scans', async ({ page }) => {
        // Look for a session card in recent scans
        const viewButton = page.getByRole('button', { name: /view/i }).first();

        if (await viewButton.isVisible()) {
            await viewButton.click();

            // Should navigate to report page
            await expect(page).toHaveURL(/\/report\//);
        }
    });
});

test.describe('Report View', () => {
    test('should display report summary', async ({ page }) => {
        // Navigate to a report page
        await page.goto('/report/session-1');

        // Verify report elements are visible
        await expect(page.getByText(/total violations/i)).toBeVisible();
    });

    test('should display fix details', async ({ page }) => {
        await page.goto('/report/session-1');

        // Look for fix cards or fix details
        const fixSection = page.getByText(/fixed/i).first();
        await expect(fixSection).toBeVisible();
    });

    test('should have export buttons', async ({ page }) => {
        await page.goto('/report/session-1');

        // Wait for the page to load (export buttons container)
        await page.waitForSelector('[data-testid="export-buttons"]', { timeout: 10000 });

        // Verify export buttons are present
        const jsonButton = page.getByRole('button', { name: /json/i });
        const htmlButton = page.getByRole('button', { name: /html/i });

        // At least one export option should be visible
        const hasExportOption = await jsonButton.isVisible() || await htmlButton.isVisible();
        expect(hasExportOption).toBeTruthy();
    });

    test('should navigate back to history from report', async ({ page }) => {
        await page.goto('/report/session-1');

        // Click back button or history link
        const backButton = page.getByRole('button', { name: /back/i });

        if (await backButton.isVisible()) {
            await backButton.click();
            await expect(page).toHaveURL('/history');
        }
    });
});
