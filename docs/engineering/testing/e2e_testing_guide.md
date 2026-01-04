# End-to-End Testing Guide

This guide covers Playwright setup, configuration, test execution, and CI/CD integration for AccessAgents E2E testing.

## Overview

AccessAgents uses [Playwright](https://playwright.dev/) for end-to-end testing. E2E tests verify complete user workflows by automating browser interactions and validating application behavior.

## Prerequisites

- Node.js 18+
- npm or yarn
- Playwright browsers installed

## Setup

### Install Dependencies

```bash
cd apps/web
npm install
```

### Install Playwright Browsers

```bash
npx playwright install
```

This installs Chromium, Firefox, and WebKit browsers for cross-browser testing.

### Install with Dependencies (CI)

For CI environments, install browsers with system dependencies:

```bash
npx playwright install --with-deps
```

## Configuration

### Playwright Configuration File

The Playwright configuration is in `apps/web/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    // Test directory
    testDir: './e2e',
    
    // Run tests in parallel
    fullyParallel: true,
    
    // Fail CI if test.only is left in code
    forbidOnly: !!process.env.CI,
    
    // Retry failed tests in CI
    retries: process.env.CI ? 2 : 0,
    
    // Limit workers in CI for stability
    workers: process.env.CI ? 1 : undefined,
    
    // HTML reporter for test results
    reporter: 'html',
    
    // Shared settings for all projects
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
    },
    
    // Browser configurations
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
        // Mobile viewports
        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
        },
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
        },
        // Tablet viewport
        {
            name: 'Tablet',
            use: { ...devices['iPad (gen 7)'] },
        },
    ],
    
    // Auto-start dev server
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
    },
});
```

### Key Configuration Options

| Option | Description |
|--------|-------------|
| `testDir` | Directory containing test files |
| `fullyParallel` | Run tests in parallel for faster execution |
| `retries` | Number of retries for failed tests |
| `workers` | Number of parallel workers |
| `reporter` | Test result reporter format |
| `baseURL` | Base URL for all tests |
| `trace` | When to capture traces for debugging |
| `webServer` | Auto-start development server |

## Test Execution

### Run All Tests

```bash
cd apps/web
npx playwright test
```

### Run Tests with UI Mode

Interactive mode for debugging and development:

```bash
npx playwright test --ui
```

### Run Specific Test File

```bash
npx playwright test e2e/scan-flow.spec.ts
```

### Run Tests by Name Pattern

```bash
npx playwright test -g "should login successfully"
```

### Run Tests in Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Tests in Headed Mode

See the browser while tests run:

```bash
npx playwright test --headed
```

### Run Tests with Debug Mode

Step through tests with Playwright Inspector:

```bash
npx playwright test --debug
```

### Generate Test Report

```bash
npx playwright show-report
```

## Test File Structure

```
apps/web/e2e/
├── auth-flow.spec.ts       # Authentication tests
├── scan-flow.spec.ts       # Scan workflow tests
├── history-flow.spec.ts    # History management tests
├── accessibility.spec.ts   # Accessibility compliance tests
├── error-recovery.spec.ts  # Error handling tests
└── fixtures/
    └── test-data.ts        # Shared test data
```

## Writing E2E Tests

### Test File Structure

```typescript
/**
 * E2E Test: Feature Name
 * Tests: Brief description of what's tested
 * Requirements: X.Y, X.Z
 */
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
    test.beforeEach(async ({ page }) => {
        // Setup before each test
        await page.goto('/');
    });

    test('should do something specific', async ({ page }) => {
        // Test implementation
    });
});
```

### Common Patterns

#### Navigation and Page Load

```typescript
test('should navigate to page', async ({ page }) => {
    await page.goto('/history');
    await expect(page).toHaveURL('/history');
    await expect(page.getByRole('heading', { name: /history/i })).toBeVisible();
});
```

#### Form Interaction

```typescript
test('should submit form', async ({ page }) => {
    await page.goto('/');
    
    // Fill form fields
    await page.getByRole('textbox', { name: /url/i }).fill('https://example.com');
    
    // Submit form
    await page.getByRole('button', { name: /scan/i }).click();
    
    // Verify result
    await expect(page).toHaveURL(/\/scan\//);
});
```

#### Authentication Flow

```typescript
test.describe('Authenticated Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/login');
        await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');
        await page.getByLabel(/password/i).fill('password123');
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL('/');
    });

    test('should access protected route', async ({ page }) => {
        await page.goto('/history');
        await expect(page.getByRole('heading', { name: /history/i })).toBeVisible();
    });
});
```

#### API Mocking

```typescript
test('should handle API errors', async ({ page }) => {
    // Intercept API calls
    await page.route('**/api/sessions**', (route) => {
        route.fulfill({
            status: 500,
            body: JSON.stringify({ message: 'Server error' }),
        });
    });

    await page.goto('/history');
    
    // Verify error handling
    await expect(page.getByText(/error|failed/i)).toBeVisible();
});
```

#### Waiting for Elements

```typescript
test('should wait for async content', async ({ page }) => {
    await page.goto('/scan/session-1');
    
    // Wait for specific element
    await page.waitForSelector('[data-testid="scan-results"]');
    
    // Or use expect with timeout
    await expect(page.getByText(/complete/i)).toBeVisible({ timeout: 30000 });
});
```

#### Keyboard Navigation

```typescript
test('should navigate with keyboard', async ({ page }) => {
    await page.goto('/');
    
    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Submit with Enter
    await page.keyboard.press('Enter');
});
```

### Accessibility Testing with axe-core

```typescript
import AxeBuilder from '@axe-core/playwright';

test('should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

    const criticalViolations = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations).toEqual([]);
});
```

### Responsive Testing

```typescript
test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Verify mobile layout
    await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
});
```

## Test Organization

### Test Categories

| File | Purpose | Requirements |
|------|---------|--------------|
| `auth-flow.spec.ts` | Login, logout, session management | 7.1, 7.2, 7.5 |
| `scan-flow.spec.ts` | URL input, scan progress, results | 1.1, 2.1, 5.1 |
| `history-flow.spec.ts` | View history, select session, delete | 6.1, 6.3, 6.4 |
| `accessibility.spec.ts` | WCAG compliance, keyboard nav | 9.4 |
| `error-recovery.spec.ts` | Error handling, reconnection | 10.2, 10.3 |

### Naming Conventions

- Test files: `{feature}-flow.spec.ts` or `{feature}.spec.ts`
- Test descriptions: Start with "should" for clarity
- Use descriptive names that explain the expected behavior

```typescript
// Good
test('should display error message when API fails', ...)
test('should navigate to report when clicking view button', ...)

// Avoid
test('test API error', ...)
test('click view', ...)
```

## Selectors

### Recommended Selector Strategy

1. **Role selectors** (preferred): `getByRole('button', { name: /scan/i })`
2. **Label selectors**: `getByLabel(/email/i)`
3. **Text selectors**: `getByText(/error/i)`
4. **Test IDs**: `getByTestId('session-card')`
5. **CSS selectors** (last resort): `locator('.class-name')`

### Examples

```typescript
// Role selectors (best for accessibility)
page.getByRole('button', { name: /submit/i })
page.getByRole('textbox', { name: /email/i })
page.getByRole('heading', { name: /history/i })
page.getByRole('link', { name: /home/i })

// Label selectors
page.getByLabel(/password/i)

// Text selectors
page.getByText(/no scans found/i)

// Test ID selectors
page.getByTestId('session-card')
page.locator('[data-testid="export-buttons"]')

// Combining selectors
page.getByRole('button', { name: /delete/i }).first()
page.locator('[data-testid="session-card"]').getByRole('button')
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: apps/web/package-lock.json
      
      - name: Install dependencies
        run: cd apps/web && npm ci
      
      - name: Install Playwright browsers
        run: cd apps/web && npx playwright install --with-deps
      
      - name: Run E2E tests
        run: cd apps/web && npx playwright test
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 30
```

### Environment Variables for CI

```bash
# Set in CI environment
CI=true                    # Enables CI-specific behavior
PLAYWRIGHT_BROWSERS_PATH=0 # Use default browser location
```

### Running Against Staging

```bash
# Run E2E tests against staging environment
VITE_API_URL=https://staging-api.example.com \
VITE_AUTH_MODE=saas \
npx playwright test
```

### Parallel Execution in CI

For faster CI runs, configure workers:

```typescript
// playwright.config.ts
export default defineConfig({
    workers: process.env.CI ? 4 : undefined,
    // Shard tests across multiple CI jobs
    // Run with: npx playwright test --shard=1/4
});
```

### Sharding for Large Test Suites

Split tests across multiple CI jobs:

```yaml
# .github/workflows/e2e.yml
jobs:
  e2e:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - name: Run E2E tests
        run: npx playwright test --shard=${{ matrix.shard }}/4
```

## Debugging

### Debug Mode

```bash
# Open Playwright Inspector
npx playwright test --debug

# Debug specific test
npx playwright test -g "should login" --debug
```

### Trace Viewer

View detailed trace of test execution:

```bash
# Generate trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

### Screenshots on Failure

```typescript
// playwright.config.ts
export default defineConfig({
    use: {
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
});
```

### Console Logs

```typescript
test('debug test', async ({ page }) => {
    // Listen to console messages
    page.on('console', msg => console.log(msg.text()));
    
    await page.goto('/');
});
```

### Network Inspection

```typescript
test('inspect network', async ({ page }) => {
    // Log all requests
    page.on('request', request => 
        console.log('>>', request.method(), request.url())
    );
    
    page.on('response', response => 
        console.log('<<', response.status(), response.url())
    );
    
    await page.goto('/');
});
```

## Best Practices

### Test Independence

Each test should be independent and not rely on other tests:

```typescript
// Good - each test sets up its own state
test.describe('History', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/history');
    });

    test('should display list', async ({ page }) => {
        // Test implementation
    });
});

// Avoid - tests depending on each other
test('create item', async ({ page }) => { /* ... */ });
test('edit item', async ({ page }) => { /* depends on create */ });
```

### Stable Selectors

Use stable selectors that won't break with UI changes:

```typescript
// Good - semantic selectors
page.getByRole('button', { name: /submit/i })
page.getByTestId('submit-button')

// Avoid - brittle selectors
page.locator('.btn-primary')
page.locator('button:nth-child(2)')
```

### Explicit Waits

Use explicit waits instead of arbitrary timeouts:

```typescript
// Good - wait for specific condition
await expect(page.getByText(/complete/i)).toBeVisible();
await page.waitForSelector('[data-testid="results"]');

// Avoid - arbitrary timeout
await page.waitForTimeout(5000);
```

### Error Messages

Provide clear error messages in assertions:

```typescript
// Good - descriptive assertion
await expect(page.getByRole('heading')).toHaveText('Dashboard', {
    message: 'Dashboard heading should be visible after login'
});

// Avoid - generic assertion
await expect(page.getByRole('heading')).toHaveText('Dashboard');
```

### Clean Up

Clean up test data when necessary:

```typescript
test.afterEach(async ({ page }) => {
    // Clean up created resources
    await page.evaluate(() => localStorage.clear());
});
```

## Troubleshooting

### Common Issues

**Tests timing out**:
- Increase timeout: `test.setTimeout(60000)`
- Check for missing `await` statements
- Verify selectors are correct

**Flaky tests**:
- Add explicit waits for async operations
- Use more specific selectors
- Check for race conditions

**Browser not starting**:
- Run `npx playwright install` to install browsers
- Check system dependencies with `npx playwright install --with-deps`

**Tests passing locally but failing in CI**:
- Check environment variables
- Verify network access
- Review CI logs for errors

### Debug Commands

```bash
# Verbose output
DEBUG=pw:api npx playwright test

# Show browser console
npx playwright test --headed

# Generate trace for all tests
npx playwright test --trace on

# Run with specific timeout
npx playwright test --timeout=60000
```

## Related Documentation

- [Testing Strategy Guide](./testing_strategy.md) - Overall testing approach
- [Local Testing Guide](./local_testing_guide.md) - Local development testing
- [Environment Testing Guide](./environment_testing_guide.md) - Multi-environment testing
- [Testing Quick Reference](./testing_quick_reference.md) - Command cheat sheet
