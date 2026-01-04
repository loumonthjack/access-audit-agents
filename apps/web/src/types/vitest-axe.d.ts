/**
 * Type declarations for vitest-axe
 * Extends Vitest's Assertion interface with axe matchers
 */
import type { AxeResults } from 'axe-core';

declare module 'vitest' {
    interface Assertion<T = unknown> {
        toHaveNoViolations(): T extends AxeResults ? void : never;
    }
    interface AsymmetricMatchersContaining {
        toHaveNoViolations(): void;
    }
}
