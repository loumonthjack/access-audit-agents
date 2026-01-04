# Testing Strategy Guide

This document outlines the testing strategy for AccessAgents, covering unit testing, property-based testing, end-to-end testing, and coverage requirements.

## Testing Philosophy

AccessAgents uses a multi-layered testing approach:

1. **Unit Tests**: Verify individual functions and components work correctly
2. **Property-Based Tests**: Validate universal properties across many generated inputs
3. **End-to-End Tests**: Ensure complete user workflows function correctly
4. **Integration Tests**: Verify components work together properly

## Testing Framework Stack

| Layer | Framework | Location |
|-------|-----------|----------|
| Unit Tests (Frontend) | Vitest + React Testing Library | `apps/web/src/**/__tests__/` |
| Unit Tests (Backend) | Vitest | `packages/core/agents/**/src/__tests__/` |
| Property-Based Tests | fast-check + Vitest | `**/*.property.test.ts` |
| E2E Tests | Playwright | `apps/web/e2e/` |
| Component Tests | React Testing Library | `apps/web/src/**/__tests__/` |

## Unit Testing

### Approach

Unit tests focus on testing individual functions, hooks, and components in isolation. They verify specific behaviors and edge cases.

### Frontend Unit Tests

Frontend tests use Vitest with React Testing Library for component testing.

**Configuration** (`apps/web/vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        testTimeout: 30000,
    },
});
```

**Example Component Test**:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScanForm } from '../ScanForm';

describe('ScanForm', () => {
    it('should submit valid URL', async () => {
        const onSubmit = vi.fn();
        render(<ScanForm onSubmit={onSubmit} />);
        
        const input = screen.getByLabelText(/url/i);
        fireEvent.change(input, { target: { value: 'https://example.com' } });
        
        const button = screen.getByRole('button', { name: /scan/i });
        fireEvent.click(button);
        
        expect(onSubmit).toHaveBeenCalledWith('https://example.com');
    });

    it('should show error for invalid URL', async () => {
        render(<ScanForm onSubmit={vi.fn()} />);
        
        const input = screen.getByLabelText(/url/i);
        fireEvent.change(input, { target: { value: 'not-a-url' } });
        fireEvent.blur(input);
        
        expect(screen.getByText(/invalid url/i)).toBeInTheDocument();
    });
});
```

**Example Hook Test**:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useScan } from '../useScan';
import { QueryClientProvider } from '@tanstack/react-query';

describe('useScan', () => {
    it('should start scan and return session ID', async () => {
        const { result } = renderHook(() => useScan(), {
            wrapper: ({ children }) => (
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            ),
        });

        await result.current.startScan('https://example.com');
        
        await waitFor(() => {
            expect(result.current.sessionId).toBeDefined();
        });
    });
});
```

### Backend Unit Tests

Backend tests use Vitest in Node.js environment.

**Configuration** (`packages/core/agents/auditor/vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.property.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        testTimeout: 30000,
    },
});
```

**Example Service Test**:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Scanner } from '../services/scanner';

describe('Scanner', () => {
    let scanner: Scanner;

    beforeEach(() => {
        scanner = new Scanner();
    });

    it('should detect missing alt text', async () => {
        const html = '<img src="test.jpg">';
        const violations = await scanner.scan(html);
        
        expect(violations).toContainEqual(
            expect.objectContaining({
                id: 'image-alt',
                impact: 'critical',
            })
        );
    });

    it('should pass for accessible images', async () => {
        const html = '<img src="test.jpg" alt="Test image">';
        const violations = await scanner.scan(html);
        
        expect(violations.filter(v => v.id === 'image-alt')).toHaveLength(0);
    });
});
```

## Property-Based Testing

### Overview

Property-based testing (PBT) validates that universal properties hold across many randomly generated inputs. Unlike unit tests that check specific examples, property tests verify invariants that should always be true.

### When to Use Property-Based Tests

Use property-based tests for:

- **Round-trip operations**: Serialize/deserialize, encode/decode
- **Invariants**: Properties that must always hold (e.g., sorted output)
- **State machines**: Valid state transitions
- **Data transformations**: Input/output relationships
- **Validation logic**: All valid inputs accepted, all invalid rejected

### Configuration

Property tests use [fast-check](https://github.com/dubzzz/fast-check) with Vitest.

**Minimum iterations**: 100 per property test

**Annotation format**: Each test tagged with feature and property reference

```typescript
/**
 * Feature: {feature-name}, Property {N}: {property-title}
 * Validates: Requirements X.Y, X.Z
 */
```

### Property Test Patterns

#### Pattern 1: Round-Trip Property

Tests that encoding then decoding returns the original value.

```typescript
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../serializer';

describe('Feature: data-serialization, Property 1: Round-trip consistency', () => {
    it('should preserve data through serialize/deserialize cycle', () => {
        fc.assert(
            fc.property(
                fc.record({
                    id: fc.uuid(),
                    name: fc.string(),
                    count: fc.integer(),
                }),
                (data) => {
                    const serialized = serialize(data);
                    const deserialized = deserialize(serialized);
                    expect(deserialized).toEqual(data);
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

#### Pattern 2: Invariant Property

Tests that a property always holds after an operation.

```typescript
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { sortViolations } from '../sorter';

describe('Feature: violation-sorting, Property 2: Sort order invariant', () => {
    it('should always return violations sorted by impact', () => {
        const violationArb = fc.record({
            id: fc.string(),
            impact: fc.constantFrom('critical', 'serious', 'moderate', 'minor'),
        });

        fc.assert(
            fc.property(
                fc.array(violationArb, { minLength: 1, maxLength: 50 }),
                (violations) => {
                    const sorted = sortViolations(violations);
                    
                    // Verify sorted order
                    const impactOrder = ['critical', 'serious', 'moderate', 'minor'];
                    for (let i = 1; i < sorted.length; i++) {
                        const prevIndex = impactOrder.indexOf(sorted[i - 1].impact);
                        const currIndex = impactOrder.indexOf(sorted[i].impact);
                        expect(prevIndex).toBeLessThanOrEqual(currIndex);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
```

#### Pattern 3: State Transition Property

Tests that state machines follow valid transitions.

```typescript
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { BatchStateMachine } from '../state-machine';

describe('Feature: batch-scanning, Property 7: Valid state transitions', () => {
    const validTransitions = {
        pending: ['running'],
        running: ['paused', 'completed', 'cancelled', 'error'],
        paused: ['running', 'cancelled'],
        completed: [],
        cancelled: [],
        error: [],
    };

    it('should only allow valid state transitions', () => {
        const stateArb = fc.constantFrom(
            'pending', 'running', 'paused', 'completed', 'cancelled', 'error'
        );

        fc.assert(
            fc.property(stateArb, stateArb, (fromState, toState) => {
                const machine = new BatchStateMachine(fromState);
                const canTransition = machine.canTransitionTo(toState);
                
                const isValidTransition = validTransitions[fromState].includes(toState);
                expect(canTransition).toBe(isValidTransition);
            }),
            { numRuns: 100 }
        );
    });
});
```

#### Pattern 4: Validation Property

Tests that validators correctly accept/reject inputs.

```typescript
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { validateSitemapUrl } from '../validator';

describe('Feature: sitemap-scanning, Property 1: URL validation', () => {
    it('should accept URLs ending with .xml', () => {
        const xmlUrlArb = fc.webUrl().map(url => url + '/sitemap.xml');

        fc.assert(
            fc.property(xmlUrlArb, (url) => {
                const result = validateSitemapUrl(url);
                expect(result.valid).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('should reject URLs without sitemap indicators', () => {
        const nonSitemapUrlArb = fc.webUrl().filter(
            url => !url.includes('sitemap') && !url.endsWith('.xml')
        );

        fc.assert(
            fc.property(nonSitemapUrlArb, (url) => {
                const result = validateSitemapUrl(url);
                expect(result.valid).toBe(false);
                expect(result.error).toBeDefined();
            }),
            { numRuns: 100 }
        );
    });
});
```

### Creating Generators

Custom generators produce domain-specific test data.

**Generator file location**: `src/__generators__/*.generator.ts`

```typescript
// src/__generators__/violation.generator.ts
import * as fc from 'fast-check';
import type { Violation } from '../types';

export const impactLevelArb = fc.constantFrom(
    'critical', 'serious', 'moderate', 'minor'
);

export const violationArb: fc.Arbitrary<Violation> = fc.record({
    id: fc.string({ minLength: 1, maxLength: 50 }),
    impact: impactLevelArb,
    description: fc.string({ minLength: 1, maxLength: 200 }),
    help: fc.string({ minLength: 1, maxLength: 500 }),
    helpUrl: fc.webUrl(),
    nodes: fc.array(
        fc.record({
            html: fc.string(),
            target: fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
        }),
        { minLength: 1, maxLength: 10 }
    ),
});

export const violationWithImpactArb = (
    impact: 'critical' | 'serious' | 'moderate' | 'minor'
): fc.Arbitrary<Violation> =>
    violationArb.map(v => ({ ...v, impact }));
```

### Property Test File Structure

```
src/
├── __generators__/
│   ├── violation.generator.ts
│   ├── fix-instruction.generator.ts
│   └── batch.generator.ts
├── __tests__/
│   ├── scanner.test.ts           # Unit tests
│   ├── scanner.property.test.ts  # Property tests
│   └── properties/
│       ├── sorting.property.test.ts
│       └── validation.property.test.ts
```

## End-to-End Testing

### Approach

E2E tests verify complete user workflows using Playwright. They test the application as a user would interact with it.

### Configuration

**Playwright config** (`apps/web/playwright.config.ts`):

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
    },
});
```

### E2E Test Examples

**Authentication Flow**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test('should login successfully', async ({ page }) => {
        await page.goto('/login');
        
        await page.fill('[name="email"]', 'test@example.com');
        await page.fill('[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        
        await expect(page).toHaveURL('/dashboard');
        await expect(page.locator('text=Welcome')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');
        
        await page.fill('[name="email"]', 'wrong@example.com');
        await page.fill('[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');
        
        await expect(page.locator('text=Invalid credentials')).toBeVisible();
    });
});
```

**Scan Flow**:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Scan Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/login');
        await page.fill('[name="email"]', 'test@example.com');
        await page.fill('[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');
    });

    test('should start and complete a scan', async ({ page }) => {
        await page.fill('[name="url"]', 'https://example.com');
        await page.click('button:has-text("Start Scan")');
        
        // Wait for scan to complete
        await expect(page.locator('text=Scan Complete')).toBeVisible({
            timeout: 60000,
        });
        
        // Verify results are displayed
        await expect(page.locator('[data-testid="violation-count"]')).toBeVisible();
    });
});
```

### E2E Test Organization

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

## Coverage Requirements

### Target Coverage

| Package | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| Frontend (`apps/web`) | 70% | 60% | 70% | 70% |
| Auditor (`packages/core/agents/auditor`) | 80% | 70% | 80% | 80% |
| Orchestrator (`packages/core/agents/orchestrator`) | 80% | 70% | 80% | 80% |

### Generating Coverage Reports

```bash
# Frontend coverage
cd apps/web
npm run test:coverage

# Backend coverage
cd packages/core/agents/auditor
npm run test:coverage

cd packages/core/agents/orchestrator
npm run test:coverage
```

### Coverage Report Locations

| Package | Report Location |
|---------|-----------------|
| Frontend | `apps/web/coverage/index.html` |
| Auditor | `packages/core/agents/auditor/coverage/index.html` |
| Orchestrator | `packages/core/agents/orchestrator/coverage/index.html` |

## Test Commands Reference

### Frontend Tests

```bash
cd apps/web

# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- src/features/scan/__tests__/useScan.test.ts

# Run E2E tests
npx playwright test

# Run E2E tests with UI
npx playwright test --ui

# Run specific E2E test
npx playwright test e2e/scan-flow.spec.ts
```

### Backend Tests

```bash
# Auditor package
cd packages/core/agents/auditor
npm run test
npm run test:coverage
npm run test:watch

# Orchestrator package
cd packages/core/agents/orchestrator
npm run test
npm run test:coverage
npm run test:watch
```

### Running All Tests

```bash
# From project root
npm run test --workspaces

# Or individually
cd apps/web && npm run test
cd packages/core/agents/auditor && npm run test
cd packages/core/agents/orchestrator && npm run test
```

## Best Practices

### Unit Test Best Practices

1. **Test one thing per test**: Each test should verify a single behavior
2. **Use descriptive names**: Test names should describe the expected behavior
3. **Arrange-Act-Assert**: Structure tests with clear setup, action, and verification
4. **Avoid testing implementation details**: Test behavior, not internal implementation
5. **Mock external dependencies**: Isolate the unit under test

### Property Test Best Practices

1. **Start with simple properties**: Begin with obvious invariants
2. **Use meaningful generators**: Create generators that produce realistic data
3. **Run sufficient iterations**: Minimum 100 runs per property
4. **Document the property**: Explain what invariant is being tested
5. **Link to requirements**: Reference the requirements being validated

### E2E Test Best Practices

1. **Test user journeys**: Focus on complete workflows
2. **Use stable selectors**: Prefer data-testid over CSS classes
3. **Handle async operations**: Use proper waits and assertions
4. **Isolate tests**: Each test should be independent
5. **Clean up test data**: Reset state between tests

## Troubleshooting

### Common Issues

**Tests timing out**:
- Increase timeout in vitest.config.ts
- Check for unresolved promises
- Verify mock setup is correct

**Property tests failing intermittently**:
- Check generator constraints
- Verify property is actually universal
- Look for edge cases in the implementation

**E2E tests flaky**:
- Add explicit waits for async operations
- Use more specific selectors
- Check for race conditions

### Debug Commands

```bash
# Run tests with verbose output
npm run test -- --reporter=verbose

# Run single test with debugging
npm run test -- --inspect-brk

# Run Playwright with debug mode
npx playwright test --debug

# View Playwright trace
npx playwright show-trace trace.zip
```

## Related Documentation

- [Local Testing Guide](./local_testing_guide.md) - Detailed local setup
- [E2E Testing Guide](./e2e_testing_guide.md) - Playwright configuration
- [Environment Testing Guide](./environment_testing_guide.md) - Multi-environment testing
- [Testing Quick Reference](./testing_quick_reference.md) - Command cheat sheet
