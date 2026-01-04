/**
 * Property-based tests for user email display when authenticated
 * Feature: web-dashboard, Property 17: User Email Display When Authenticated
 * Validates: Requirements 7.4
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserMenu } from '../UserMenu';
import type { User, AuthProviderType } from '@/types/domain';

/**
 * Arbitrary for generating auth provider types
 */
const authProviderArbitrary = fc.constantFrom<AuthProviderType>(
  'cognito',
  'google',
  'github',
  'local'
);

/**
 * Arbitrary for generating valid email addresses
 */
const emailArbitrary = fc.emailAddress();

/**
 * Arbitrary for generating User objects with valid emails
 */
const userArbitrary: fc.Arbitrary<User> = fc.record({
  id: fc.uuid(),
  email: emailArbitrary,
  name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  avatarUrl: fc.option(fc.webUrl(), { nil: undefined }),
  authProvider: authProviderArbitrary,
});

describe('Property 17: User Email Display When Authenticated', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /**
   * Property 17a: User email is displayed in UserMenu
   * For any authenticated user, the UserMenu SHALL display the user's email address.
   * Validates: Requirements 7.4
   */
  it('Property 17a: User email is displayed in UserMenu', async () => {
    await fc.assert(
      fc.asyncProperty(userArbitrary, async (user) => {
        cleanup(); // Clean up before each iteration

        const mockLogout = vi.fn();

        render(<UserMenu user={user} onLogout={mockLogout} />);

        // The email should be visible in the button (on desktop)
        // Note: The email is hidden on mobile with md:block class
        // but we're testing the DOM content, not CSS visibility
        const emailElements = screen.getAllByText(user.email);
        expect(emailElements.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17b: Displayed email matches authenticated user's email
   * For any authenticated user, the email displayed SHALL exactly match
   * the user's email property.
   * Validates: Requirements 7.4
   */
  it('Property 17b: Displayed email matches authenticated user email', async () => {
    await fc.assert(
      fc.asyncProperty(userArbitrary, async (user) => {
        cleanup(); // Clean up before each iteration

        const mockLogout = vi.fn();

        render(<UserMenu user={user} onLogout={mockLogout} />);

        // Find all text content containing the email
        const emailElements = screen.getAllByText(user.email);

        // At least one element should contain the exact email
        const hasExactMatch = emailElements.some((el) => el.textContent === user.email);
        expect(hasExactMatch).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17c: Email is displayed in dropdown menu
   * For any authenticated user, when the menu is expanded,
   * the email SHALL be visible in the dropdown.
   * Validates: Requirements 7.4
   */
  it('Property 17c: Email is displayed in dropdown menu when expanded', async () => {
    const user = userEvent.setup();

    await fc.assert(
      fc.asyncProperty(userArbitrary, async (testUser) => {
        cleanup(); // Clean up before each iteration

        const mockLogout = vi.fn();

        render(<UserMenu user={testUser} onLogout={mockLogout} />);

        // Click to open the menu using userEvent
        const menuButton = screen.getByRole('button', { name: /user menu/i });
        await user.click(menuButton);

        // Wait for the dropdown to appear
        await waitFor(() => {
          const emailInDropdown = screen.getByTestId('user-email');
          expect(emailInDropdown).toBeInTheDocument();
          expect(emailInDropdown.textContent).toBe(testUser.email);
        });
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17d: Different users show different emails
   * For any two different users with different emails,
   * the displayed emails SHALL be different.
   * Validates: Requirements 7.4
   */
  it('Property 17d: Different users show different emails', async () => {
    const user = userEvent.setup();

    await fc.assert(
      fc.asyncProperty(userArbitrary, userArbitrary, async (user1, user2) => {
        // Skip if emails happen to be the same
        if (user1.email === user2.email) return;

        cleanup(); // Clean up before each iteration

        const mockLogout = vi.fn();

        // Render first user
        const { unmount } = render(<UserMenu user={user1} onLogout={mockLogout} />);

        // Open menu and get email
        const menuButton1 = screen.getByRole('button', { name: /user menu/i });
        await user.click(menuButton1);

        await waitFor(() => {
          expect(screen.getByTestId('user-email')).toBeInTheDocument();
        });

        const email1 = screen.getByTestId('user-email').textContent;

        unmount();
        cleanup();

        // Render second user
        render(<UserMenu user={user2} onLogout={mockLogout} />);

        // Open menu and get email
        const menuButton2 = screen.getByRole('button', { name: /user menu/i });
        await user.click(menuButton2);

        await waitFor(() => {
          expect(screen.getByTestId('user-email')).toBeInTheDocument();
        });

        const email2 = screen.getByTestId('user-email').textContent;

        // Emails should be different
        expect(email1).not.toBe(email2);
        expect(email1).toBe(user1.email);
        expect(email2).toBe(user2.email);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17e: Email display is consistent across interactions
   * For any authenticated user, the email SHALL remain consistent
   * after opening and closing the menu multiple times.
   * Validates: Requirements 7.4
   */
  it('Property 17e: Email display is consistent across interactions', async () => {
    const user = userEvent.setup();

    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        fc.integer({ min: 1, max: 3 }), // Number of toggle cycles (reduced for speed)
        async (testUser, toggleCount) => {
          cleanup(); // Clean up before each iteration

          const mockLogout = vi.fn();

          render(<UserMenu user={testUser} onLogout={mockLogout} />);

          const menuButton = screen.getByRole('button', { name: /user menu/i });

          // Toggle menu multiple times
          for (let i = 0; i < toggleCount; i++) {
            await user.click(menuButton); // Open

            // Verify email is correct when open
            await waitFor(() => {
              const emailElement = screen.getByTestId('user-email');
              expect(emailElement.textContent).toBe(testUser.email);
            });

            await user.click(menuButton); // Close

            // Wait for menu to close
            await waitFor(() => {
              expect(screen.queryByTestId('user-email')).not.toBeInTheDocument();
            });
          }

          // Final check - open and verify
          await user.click(menuButton);
          await waitFor(() => {
            const finalEmailElement = screen.getByTestId('user-email');
            expect(finalEmailElement.textContent).toBe(testUser.email);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
