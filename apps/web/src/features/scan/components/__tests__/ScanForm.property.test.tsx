/**
 * Property-based tests for ScanForm component
 * Feature: web-dashboard, Property 1: Valid URL Triggers API Call
 * Validates: Requirements 1.1
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { ScanForm } from '../ScanForm';

/**
 * Arbitrary for generating valid URLs
 */
const validUrlArbitrary = fc.oneof(
    fc.webUrl({ validSchemes: ['https'] }),
    fc.webUrl({ validSchemes: ['http'] })
);

/**
 * Arbitrary for generating viewport values
 */
const viewportArbitrary = fc.constantFrom('desktop' as const, 'mobile' as const);

describe('ScanForm Property Tests', () => {
    afterEach(() => {
        cleanup();
    });

    /**
     * Property 1: Valid URL Triggers API Call
     * For any valid URL entered in the ScanForm, clicking the scan button
     * SHALL trigger exactly one mutation call to startScan with the URL and selected viewport.
     * Validates: Requirements 1.1
     */
    it('Property 1: Valid URL triggers exactly one onSubmit call with correct parameters', async () => {
        await fc.assert(
            fc.asyncProperty(
                validUrlArbitrary,
                viewportArbitrary,
                async (generatedUrl, viewport) => {
                    // Clean up before each iteration
                    cleanup();

                    const onSubmit = vi.fn();
                    const user = userEvent.setup();

                    render(
                        <ScanForm
                            onSubmit={onSubmit}
                            isLoading={false}
                        />
                    );

                    // Enter the URL
                    const urlInput = screen.getByLabelText(/website url/i);
                    await user.clear(urlInput);
                    await user.type(urlInput, generatedUrl);

                    // Select viewport if not desktop (default)
                    if (viewport === 'mobile') {
                        const viewportSelect = screen.getByRole('button', { name: /desktop/i });
                        await user.click(viewportSelect);
                        const mobileOption = await screen.findByRole('option', { name: /mobile/i });
                        await user.click(mobileOption);
                    }

                    // Submit the form
                    const submitButton = screen.getByTestId('scan-submit-button');
                    await user.click(submitButton);

                    // Wait for form submission
                    await waitFor(() => {
                        expect(onSubmit).toHaveBeenCalledTimes(1);
                    });

                    // Verify correct parameters
                    expect(onSubmit).toHaveBeenCalledWith(generatedUrl, viewport);

                    // Clean up after each iteration
                    cleanup();
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe('ScanForm Loading State Property Tests', () => {
    afterEach(() => {
        cleanup();
    });

    /**
     * Property 2: Loading State on Scan Initiation
     * For any scan initiation, the mutation state SHALL be isPending: true immediately
     * and remain pending until either success or error. The UI SHALL reflect this loading state.
     * Validates: Requirements 1.2
     */
    it('Property 2: Loading state is reflected in UI when isLoading is true', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constant(null), // Placeholder to maintain property test structure
                async () => {
                    cleanup();

                    const onSubmit = vi.fn();

                    // Render with loading state
                    render(
                        <ScanForm
                            onSubmit={onSubmit}
                            isLoading={true}
                        />
                    );

                    // Verify button shows loading state
                    const submitButton = screen.getByTestId('scan-submit-button');
                    expect(submitButton).toBeDisabled();
                    expect(submitButton).toHaveAttribute('aria-busy', 'true');
                    expect(submitButton).toHaveTextContent(/scanning/i);

                    // Verify input is disabled during loading
                    const urlInput = screen.getByLabelText(/website url/i);
                    expect(urlInput).toBeDisabled();

                    cleanup();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 2b: Non-loading state allows interaction
     * When isLoading is false, the form should be interactive
     * Validates: Requirements 1.2
     */
    it('Property 2b: Non-loading state allows form interaction', async () => {
        await fc.assert(
            fc.asyncProperty(
                validUrlArbitrary,
                async () => {
                    cleanup();

                    const onSubmit = vi.fn();

                    render(
                        <ScanForm
                            onSubmit={onSubmit}
                            isLoading={false}
                        />
                    );

                    // Verify button is not in loading state
                    const submitButton = screen.getByTestId('scan-submit-button');
                    expect(submitButton).not.toBeDisabled();
                    expect(submitButton).toHaveAttribute('aria-busy', 'false');
                    expect(submitButton).toHaveTextContent(/start scan/i);

                    // Verify input is enabled
                    const urlInput = screen.getByLabelText(/website url/i);
                    expect(urlInput).not.toBeDisabled();

                    cleanup();
                }
            ),
            { numRuns: 100 }
        );
    });
});


/**
 * Arbitrary for generating invalid URLs (malformed) - safe for userEvent.type
 * Avoids special characters that userEvent interprets as keyboard commands
 */
const invalidUrlArbitrary = fc.oneof(
    fc.constant(''),
    fc.constant('not-a-url'),
    fc.constant('ftp://example.com'),
    fc.constant('example.com'),
    fc.constant('http://'),
    fc.constant('https://'),
    fc.constant('invalid'),
    fc.constant('www.example.com'),
    fc.constant('mailto:test@example.com')
);

/**
 * Arbitrary for generating non-empty error messages
 * Uses alphanumeric strings to avoid whitespace normalization issues
 */
const errorMessageArbitrary = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0)
    .map(s => s.replace(/\s+/g, ' ').trim()); // Normalize whitespace

describe('ScanForm Error Display Property Tests', () => {
    afterEach(() => {
        cleanup();
    });

    /**
     * Property 3: Error Display for Invalid URLs
     * For any invalid URL (malformed or unreachable), the Dashboard SHALL display
     * an error message containing the reason, and the error message SHALL be non-empty.
     * Validates: Requirements 1.3
     */
    it('Property 3: Error prop displays non-empty error message', async () => {
        await fc.assert(
            fc.asyncProperty(
                errorMessageArbitrary,
                async (errorMessage) => {
                    cleanup();

                    const onSubmit = vi.fn();

                    render(
                        <ScanForm
                            onSubmit={onSubmit}
                            isLoading={false}
                            error={errorMessage}
                        />
                    );

                    // Verify error message is displayed
                    const errorElement = screen.getByRole('alert');
                    expect(errorElement).toBeInTheDocument();
                    // The component wraps the error with "Error starting scan" prefix
                    // Check that the error message is contained within the alert
                    expect(errorElement.textContent).toContain(errorMessage.trim());
                    expect(errorElement.textContent?.trim().length).toBeGreaterThan(0);

                    cleanup();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 3b: Form validation shows error for invalid URLs
     * When user submits invalid URL, form validation should prevent submission
     * Validates: Requirements 1.3
     */
    it('Property 3b: Invalid URL shows validation error and prevents submission', async () => {
        await fc.assert(
            fc.asyncProperty(
                invalidUrlArbitrary,
                async (invalidUrl) => {
                    cleanup();

                    const onSubmit = vi.fn();
                    const user = userEvent.setup();

                    render(
                        <ScanForm
                            onSubmit={onSubmit}
                            isLoading={false}
                        />
                    );

                    // Enter invalid URL
                    const urlInput = screen.getByLabelText(/website url/i);
                    await user.clear(urlInput);
                    if (invalidUrl) {
                        await user.type(urlInput, invalidUrl);
                    }

                    // Try to submit
                    const submitButton = screen.getByTestId('scan-submit-button');
                    await user.click(submitButton);

                    // Wait a bit for validation
                    await waitFor(() => {
                        // onSubmit should NOT have been called for invalid URLs
                        expect(onSubmit).not.toHaveBeenCalled();
                    });

                    cleanup();
                }
            ),
            { numRuns: 100 }
        );
    });
});


describe('ScanForm Button Disabled State Property Tests', () => {
    afterEach(() => {
        cleanup();
    });

    /**
     * Property 4: Scan Button Disabled During Active Scan
     * For any active ScanSession (status not 'pending' or 'complete'),
     * the scan button SHALL be disabled and the current session status SHALL be visible.
     * Validates: Requirements 1.5
     */
    it('Property 4: Scan button is disabled when disabled prop is true', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.boolean(),
                async (isDisabled) => {
                    cleanup();

                    const onSubmit = vi.fn();

                    render(
                        <ScanForm
                            onSubmit={onSubmit}
                            isLoading={false}
                            disabled={isDisabled}
                        />
                    );

                    const submitButton = screen.getByTestId('scan-submit-button');
                    
                    if (isDisabled) {
                        expect(submitButton).toBeDisabled();
                    } else {
                        expect(submitButton).not.toBeDisabled();
                    }

                    cleanup();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 4b: Disabled form prevents submission
     * When form is disabled, clicking submit should not trigger onSubmit
     * Validates: Requirements 1.5
     */
    it('Property 4b: Disabled form prevents submission', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constant(null), // Placeholder to maintain property test structure
                async () => {
                    cleanup();

                    const onSubmit = vi.fn();
                    const user = userEvent.setup();

                    render(
                        <ScanForm
                            onSubmit={onSubmit}
                            isLoading={false}
                            disabled={true}
                        />
                    );

                    // Try to enter URL (should be disabled)
                    const urlInput = screen.getByLabelText(/website url/i);
                    expect(urlInput).toBeDisabled();

                    // Try to click submit (should be disabled)
                    const submitButton = screen.getByTestId('scan-submit-button');
                    expect(submitButton).toBeDisabled();
                    
                    // Attempt to click anyway
                    await user.click(submitButton);

                    // onSubmit should not have been called
                    expect(onSubmit).not.toHaveBeenCalled();

                    cleanup();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 4c: Loading state also disables the button
     * When isLoading is true, button should be disabled regardless of disabled prop
     * Validates: Requirements 1.5
     */
    it('Property 4c: Loading state disables button regardless of disabled prop', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.boolean(),
                async (disabledProp) => {
                    cleanup();

                    const onSubmit = vi.fn();

                    render(
                        <ScanForm
                            onSubmit={onSubmit}
                            isLoading={true}
                            disabled={disabledProp}
                        />
                    );

                    const submitButton = screen.getByTestId('scan-submit-button');
                    // Button should always be disabled when loading
                    expect(submitButton).toBeDisabled();

                    cleanup();
                }
            ),
            { numRuns: 100 }
        );
    });
});
