/**
 * Property Test: Dashboard Accessibility Compliance
 * Property 18: For any page in the Dashboard, running axe-core accessibility checks
 * SHALL produce zero critical or serious violations.
 *
 * Feature: web-dashboard, Property 18: Dashboard Accessibility Compliance
 * Validates: Requirements 9.4
 */
import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import * as fc from 'fast-check';

// Components to test
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { LoadingSpinner, FullPageLoader, InlineLoader } from '../feedback/LoadingSpinner';
import {
  EmptyState,
  NoResultsEmptyState,
  NoDataEmptyState,
  ErrorEmptyState,
} from '../feedback/EmptyState';
import { ConnectionBanner } from '../feedback/ConnectionBanner';

// Extend expect with accessibility matchers
expect.extend(toHaveNoViolations);

/**
 * Arbitrary generators for component props
 */
const textArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);
const buttonVariantArb = fc.constantFrom('primary', 'secondary', 'ghost', 'danger');
const buttonSizeArb = fc.constantFrom('sm', 'md', 'lg');
const badgeVariantArb = fc.constantFrom('default', 'primary', 'success', 'warning', 'error');
const badgeSizeArb = fc.constantFrom('sm', 'md');
const connectionStatusArb = fc.constantFrom('connected', 'disconnected', 'error');
const wsStatusArb = fc.constantFrom('connected', 'connecting', 'disconnected', 'reconnecting');

describe('Property 18: Dashboard Accessibility Compliance', () => {
  /**
   * Property: Button component accessibility
   * For any valid button props, the rendered button SHALL have no critical/serious violations
   */
  it('Button component has no accessibility violations for any valid props', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        buttonVariantArb,
        buttonSizeArb,
        fc.boolean(),
        fc.boolean(),
        async (text, variant, size, disabled, isLoading) => {
          cleanup();
          const { container } = render(
            <Button
              variant={variant as 'primary' | 'secondary' | 'ghost' | 'danger'}
              size={size as 'sm' | 'md' | 'lg'}
              disabled={disabled}
              isLoading={isLoading}
            >
              {text}
            </Button>
          );

          const results = await axe(container);

          // Filter for critical and serious violations only
          const criticalOrSerious = results.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );

          expect(criticalOrSerious).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Input component accessibility
   * For any valid input props, the rendered input SHALL have no critical/serious violations
   */
  it('Input component has no accessibility violations for any valid props', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        fc.option(textArb, { nil: undefined }),
        fc.option(textArb, { nil: undefined }),
        fc.boolean(),
        async (label, placeholder, errorMessage, disabled) => {
          cleanup();
          const { container } = render(
            <Input
              label={label}
              placeholder={placeholder}
              errorMessage={errorMessage}
              disabled={disabled}
            />
          );

          const results = await axe(container);

          const criticalOrSerious = results.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );

          expect(criticalOrSerious).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Card component accessibility
   * For any valid card content, the rendered card SHALL have no critical/serious violations
   */
  it('Card component has no accessibility violations for any valid content', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, textArb, async (title, content) => {
        cleanup();
        const { container } = render(
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{content}</p>
            </CardContent>
          </Card>
        );

        const results = await axe(container);

        const criticalOrSerious = results.violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious'
        );

        expect(criticalOrSerious).toHaveLength(0);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Badge component accessibility
   * For any valid badge props, the rendered badge SHALL have no critical/serious violations
   */
  it('Badge component has no accessibility violations for any valid props', async () => {
    await fc.assert(
      fc.asyncProperty(textArb, badgeVariantArb, badgeSizeArb, async (text, variant, size) => {
        cleanup();
        const { container } = render(
          <Badge
            variant={variant as 'default' | 'primary' | 'success' | 'warning' | 'error'}
            size={size as 'sm' | 'md'}
          >
            {text}
          </Badge>
        );

        const results = await axe(container);

        const criticalOrSerious = results.violations.filter(
          (v) => v.impact === 'critical' || v.impact === 'serious'
        );

        expect(criticalOrSerious).toHaveLength(0);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Loading components accessibility
   * For any loading state, the rendered loaders SHALL have no critical/serious violations
   */
  it('Loading components have no accessibility violations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(textArb, { nil: undefined }),
        fc.constantFrom('sm', 'md', 'lg'),
        async (label, size) => {
          cleanup();

          // Test LoadingSpinner
          const { container: spinnerContainer } = render(
            <LoadingSpinner label={label} size={size as 'sm' | 'md' | 'lg'} />
          );
          const spinnerResults = await axe(spinnerContainer);
          const spinnerCritical = spinnerResults.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );
          expect(spinnerCritical).toHaveLength(0);

          cleanup();

          // Test FullPageLoader
          const { container: fullPageContainer } = render(<FullPageLoader label={label} />);
          const fullPageResults = await axe(fullPageContainer);
          const fullPageCritical = fullPageResults.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );
          expect(fullPageCritical).toHaveLength(0);

          cleanup();

          // Test InlineLoader
          const { container: inlineContainer } = render(<InlineLoader label={label} />);
          const inlineResults = await axe(inlineContainer);
          const inlineCritical = inlineResults.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );
          expect(inlineCritical).toHaveLength(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: EmptyState components accessibility
   * For any empty state configuration, the rendered component SHALL have no critical/serious violations
   */
  it('EmptyState components have no accessibility violations', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        fc.option(textArb, { nil: undefined }),
        async (title, description) => {
          cleanup();

          // Test base EmptyState
          const { container: emptyContainer } = render(
            <EmptyState title={title} description={description} />
          );
          const emptyResults = await axe(emptyContainer);
          const emptyCritical = emptyResults.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );
          expect(emptyCritical).toHaveLength(0);

          cleanup();

          // Test NoResultsEmptyState
          const { container: noResultsContainer } = render(<NoResultsEmptyState />);
          const noResultsResults = await axe(noResultsContainer);
          const noResultsCritical = noResultsResults.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );
          expect(noResultsCritical).toHaveLength(0);

          cleanup();

          // Test NoDataEmptyState
          const { container: noDataContainer } = render(<NoDataEmptyState />);
          const noDataResults = await axe(noDataContainer);
          const noDataCritical = noDataResults.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );
          expect(noDataCritical).toHaveLength(0);

          cleanup();

          // Test ErrorEmptyState
          const { container: errorContainer } = render(<ErrorEmptyState />);
          const errorResults = await axe(errorContainer);
          const errorCritical = errorResults.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );
          expect(errorCritical).toHaveLength(0);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: ConnectionBanner accessibility
   * For any connection state, the rendered banner SHALL have no critical/serious violations
   */
  it('ConnectionBanner has no accessibility violations for any connection state', async () => {
    await fc.assert(
      fc.asyncProperty(
        connectionStatusArb,
        wsStatusArb,
        fc.option(textArb, { nil: undefined }),
        async (apiStatus, wsStatus, errorMessage) => {
          cleanup();
          const { container } = render(
            <ConnectionBanner
              apiStatus={apiStatus as 'connected' | 'disconnected' | 'error'}
              wsStatus={wsStatus as 'connected' | 'connecting' | 'disconnected' | 'reconnecting'}
              lastError={errorMessage ?? null}
              onRetry={() => {}}
            />
          );

          const results = await axe(container);

          const criticalOrSerious = results.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );

          expect(criticalOrSerious).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Combined component accessibility
   * For any combination of components in a typical page layout,
   * the rendered page SHALL have no critical/serious violations
   */
  it('Combined components in page layout have no accessibility violations', async () => {
    await fc.assert(
      fc.asyncProperty(
        textArb,
        textArb,
        textArb,
        buttonVariantArb,
        async (pageTitle, cardTitle, inputLabel, buttonVariant) => {
          cleanup();
          const { container } = render(
            <main>
              <h1>{pageTitle}</h1>
              <Card>
                <CardHeader>
                  <CardTitle>{cardTitle}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form>
                    <Input label={inputLabel} />
                    <Button
                      type="submit"
                      variant={buttonVariant as 'primary' | 'secondary' | 'ghost' | 'danger'}
                    >
                      Submit
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </main>
          );

          const results = await axe(container);

          const criticalOrSerious = results.violations.filter(
            (v) => v.impact === 'critical' || v.impact === 'serious'
          );

          expect(criticalOrSerious).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
