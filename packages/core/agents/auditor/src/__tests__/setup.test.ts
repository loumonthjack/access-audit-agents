import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: core-auditor-agent
 * 
 * Basic setup verification tests to ensure the test framework
 * and fast-check integration are working correctly.
 */

describe('Test Setup Verification', () => {
    it('should run basic vitest tests', () => {
        expect(1 + 1).toBe(2);
    });

    it('should have fast-check integration working', () => {
        fc.assert(
            fc.property(fc.integer(), fc.integer(), (a, b) => {
                return a + b === b + a;
            }),
            { numRuns: 100 }
        );
    });

    it('should import types from the package', async () => {
        const types = await import('../types/index.js');
        expect(types).toBeDefined();
    });
});
