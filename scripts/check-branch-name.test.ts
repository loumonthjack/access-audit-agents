/**
 * Property-Based Tests for Branch Name Validation Script
 * 
 * Feature: ci-and-git-hooks, Property 1: Branch Name Validation Correctness
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 * 
 * Property: For any branch name string, the validation script returns success 
 * (exit code 0) if and only if the branch name matches one of the allowed patterns:
 * `feature/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`, `test/*`, `hotfix/*`,
 * `main`, `develop`, or `staging`.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { execSync } from 'child_process';
import { resolve } from 'path';

const SCRIPT_PATH = resolve(__dirname, 'check-branch-name.sh');

// Valid branch prefixes
const VALID_PREFIXES = ['feature', 'fix', 'chore', 'docs', 'refactor', 'test', 'hotfix'];
const PROTECTED_BRANCHES = ['main', 'develop', 'staging'];

/**
 * Execute the branch validation script and return the exit code
 */
function validateBranchName(branchName: string): { exitCode: number; output: string } {
    try {
        const output = execSync(`${SCRIPT_PATH} "${branchName}"`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        return { exitCode: 0, output };
    } catch (error: unknown) {
        const execError = error as { status?: number; stdout?: string; stderr?: string };
        return {
            exitCode: execError.status ?? 1,
            output: execError.stdout ?? execError.stderr ?? '',
        };
    }
}

/**
 * Check if a branch name should be valid according to our rules
 */
function shouldBeValid(branchName: string): boolean {
    // Check protected branches
    if (PROTECTED_BRANCHES.includes(branchName)) {
        return true;
    }

    // Check valid prefix patterns (prefix/something where something is non-empty)
    for (const prefix of VALID_PREFIXES) {
        if (branchName.startsWith(`${prefix}/`) && branchName.length > prefix.length + 1) {
            return true;
        }
    }

    return false;
}

// Arbitrary for generating valid branch suffixes (non-empty strings without problematic chars)
const branchSuffixArb = fc.string({
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
    minLength: 1,
    maxLength: 30,
});

// Arbitrary for generating valid prefixed branch names
const validPrefixedBranchArb = fc.tuple(
    fc.constantFrom(...VALID_PREFIXES),
    branchSuffixArb
).map(([prefix, suffix]) => `${prefix}/${suffix}`);

// Arbitrary for generating protected branch names
const protectedBranchArb = fc.constantFrom(...PROTECTED_BRANCHES);

// Arbitrary for generating any valid branch name
const validBranchArb = fc.oneof(validPrefixedBranchArb, protectedBranchArb);

// Arbitrary for generating invalid branch names
const invalidBranchArb = fc.string({
    unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_/'.split('')),
    minLength: 1,
    maxLength: 50,
}).filter(name => !shouldBeValid(name));

describe('Branch Name Validation Script - Property Tests', () => {
    /**
     * Feature: ci-and-git-hooks, Property 1: Branch Name Validation Correctness
     * Validates: Requirements 5.1, 5.2, 5.3, 5.4
     */
    describe('Property 1: Branch Name Validation Correctness', () => {
        it('should accept all valid prefixed branch names', () => {
            fc.assert(
                fc.property(validPrefixedBranchArb, (branchName) => {
                    const result = validateBranchName(branchName);
                    expect(result.exitCode).toBe(0);
                }),
                { numRuns: 100 }
            );
        });

        it('should accept all protected branch names', () => {
            fc.assert(
                fc.property(protectedBranchArb, (branchName) => {
                    const result = validateBranchName(branchName);
                    expect(result.exitCode).toBe(0);
                }),
                { numRuns: 100 }
            );
        });

        it('should reject invalid branch names', () => {
            fc.assert(
                fc.property(invalidBranchArb, (branchName) => {
                    const result = validateBranchName(branchName);
                    expect(result.exitCode).toBe(1);
                }),
                { numRuns: 100 }
            );
        });

        it('should be consistent: validation result matches expected validity', () => {
            // Generate any branch-like string and verify consistency
            const anyBranchArb = fc.string({
                unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_/'.split('')),
                minLength: 1,
                maxLength: 40,
            });

            fc.assert(
                fc.property(anyBranchArb, (branchName) => {
                    const result = validateBranchName(branchName);
                    const expectedValid = shouldBeValid(branchName);

                    if (expectedValid) {
                        expect(result.exitCode).toBe(0);
                    } else {
                        expect(result.exitCode).toBe(1);
                    }
                }),
                { numRuns: 100 }
            );
        });
    });

    // Unit tests for specific edge cases
    describe('Edge Cases', () => {
        it('should fall back to current git branch when empty string is passed', () => {
            // When empty string is passed, script uses current git branch
            // This is expected behavior - the script validates the current branch
            const result = validateBranchName('');
            // Should succeed since it falls back to current branch (main)
            expect(result.exitCode).toBe(0);
        });

        it('should reject prefix without suffix (e.g., "feature/")', () => {
            for (const prefix of VALID_PREFIXES) {
                const result = validateBranchName(`${prefix}/`);
                expect(result.exitCode).toBe(1);
            }
        });

        it('should reject branches with only prefix (no slash)', () => {
            for (const prefix of VALID_PREFIXES) {
                const result = validateBranchName(prefix);
                expect(result.exitCode).toBe(1);
            }
        });

        it('should accept nested paths after prefix', () => {
            const result = validateBranchName('feature/auth/login-page');
            expect(result.exitCode).toBe(0);
        });
    });
});
