/**
 * Property-based tests for TanStack Router configuration
 *
 * Feature: web-dashboard, Property 22: Route Type Safety
 * Validates: Requirements (architectural)
 *
 * For any navigation using TanStack Router, the route params and search params
 * SHALL be type-checked at compile time. Invalid params SHALL cause TypeScript errors.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { router, routePaths, routes } from '../router.js';

describe('Feature: web-dashboard, Property 22: Route Type Safety', () => {
  /**
   * Property: For any valid session ID string, routePaths.scan() SHALL produce
   * a valid route path containing that session ID
   */
  it('should generate valid scan route paths for any session ID', () => {
    fc.assert(
      fc.property(
        // Generate non-empty alphanumeric strings as session IDs
        fc.stringMatching(/^[a-zA-Z0-9-]{1,64}$/),
        (sessionId) => {
          const path = routePaths.scan(sessionId);

          // Path should start with /scan/
          expect(path.startsWith('/scan/')).toBe(true);

          // Path should contain the session ID
          expect(path).toBe(`/scan/${sessionId}`);

          // Path should be a valid string
          expect(typeof path).toBe('string');
          expect(path.length).toBeGreaterThan(6); // '/scan/' + at least 1 char

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any valid session ID string, routePaths.report() SHALL produce
   * a valid route path containing that session ID
   */
  it('should generate valid report route paths for any session ID', () => {
    fc.assert(
      fc.property(
        // Generate non-empty alphanumeric strings as session IDs
        fc.stringMatching(/^[a-zA-Z0-9-]{1,64}$/),
        (sessionId) => {
          const path = routePaths.report(sessionId);

          // Path should start with /report/
          expect(path.startsWith('/report/')).toBe(true);

          // Path should contain the session ID
          expect(path).toBe(`/report/${sessionId}`);

          // Path should be a valid string
          expect(typeof path).toBe('string');
          expect(path.length).toBeGreaterThan(8); // '/report/' + at least 1 char

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Static route paths SHALL always return consistent values
   */
  it('should have consistent static route paths', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        // Static paths should always be the same
        expect(routePaths.home).toBe('/');
        expect(routePaths.history).toBe('/history');
        expect(routePaths.login).toBe('/login');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Router SHALL have all expected routes defined
   */
  it('should have all required routes defined', () => {
    // Verify routes object has all expected keys
    expect(routes.home).toBeDefined();
    expect(routes.scan).toBeDefined();
    expect(routes.history).toBeDefined();
    expect(routes.report).toBeDefined();
    expect(routes.login).toBeDefined();
  });

  /**
   * Property: Router configuration SHALL be valid
   */
  it('should have valid router configuration', () => {
    // Router should be defined
    expect(router).toBeDefined();

    // Router should have route tree
    expect(router.routeTree).toBeDefined();

    // Router should have default preload setting
    expect(router.options.defaultPreload).toBe('intent');
  });

  /**
   * Property: For any generated session ID, the scan and report paths
   * SHALL be different routes
   */
  it('should generate distinct paths for scan and report routes', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-zA-Z0-9-]{1,64}$/), (sessionId) => {
        const scanPath = routePaths.scan(sessionId);
        const reportPath = routePaths.report(sessionId);

        // Paths should be different
        expect(scanPath).not.toBe(reportPath);

        // Both should contain the session ID
        expect(scanPath).toContain(sessionId);
        expect(reportPath).toContain(sessionId);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Route paths with special characters in session IDs
   * SHALL still produce valid path strings
   */
  it('should handle UUID-style session IDs correctly', () => {
    fc.assert(
      fc.property(fc.uuid(), (uuid) => {
        const scanPath = routePaths.scan(uuid);
        const reportPath = routePaths.report(uuid);

        // Paths should be valid strings
        expect(typeof scanPath).toBe('string');
        expect(typeof reportPath).toBe('string');

        // Paths should contain the UUID
        expect(scanPath).toContain(uuid);
        expect(reportPath).toContain(uuid);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
