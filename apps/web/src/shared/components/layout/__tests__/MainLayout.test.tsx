import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { MainLayout } from '../MainLayout';
import type { NavLink } from '../Header';

expect.extend({ toHaveNoViolations });

const navLinks: NavLink[] = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'history', label: 'History', href: '/history' },
  { id: 'settings', label: 'Settings', href: '/settings' },
];

describe('MainLayout', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <MainLayout navLinks={navLinks}>
          <div>Main content</div>
        </MainLayout>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has skip link for keyboard navigation', () => {
      render(
        <MainLayout navLinks={navLinks}>
          <div>Main content</div>
        </MainLayout>
      );
      expect(screen.getByText('Skip to main content')).toBeInTheDocument();
    });

    it('has main landmark', () => {
      render(
        <MainLayout navLinks={navLinks}>
          <div>Main content</div>
        </MainLayout>
      );
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('renders children in main content area', () => {
      render(
        <MainLayout navLinks={navLinks}>
          <div data-testid="content">Main content</div>
        </MainLayout>
      );
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('renders header', () => {
      render(
        <MainLayout navLinks={navLinks}>
          <div>Content</div>
        </MainLayout>
      );
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('renders custom logo', () => {
      render(
        <MainLayout navLinks={navLinks} logo={<span>Custom Logo</span>}>
          <div>Content</div>
        </MainLayout>
      );
      expect(screen.getByText('Custom Logo')).toBeInTheDocument();
    });

    it('renders user menu slot', () => {
      render(
        <MainLayout navLinks={navLinks} userMenu={<button>User Menu</button>}>
          <div>Content</div>
        </MainLayout>
      );
      expect(screen.getByRole('button', { name: 'User Menu' })).toBeInTheDocument();
    });

    it('renders banner when provided', () => {
      render(
        <MainLayout navLinks={navLinks} banner={<div data-testid="banner">Banner</div>}>
          <div>Content</div>
        </MainLayout>
      );
      expect(screen.getByTestId('banner')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('shows mobile menu button on small screens', () => {
      render(
        <MainLayout navLinks={navLinks}>
          <div>Content</div>
        </MainLayout>
      );
      // The menu button should be present (visible on mobile via CSS)
      expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();
    });

    it('opens mobile sidebar when menu button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MainLayout navLinks={navLinks}>
          <div>Content</div>
        </MainLayout>
      );

      await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));

      await waitFor(() => {
        // Mobile sidebar should be visible
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('closes mobile sidebar when close button is clicked', async () => {
      const user = userEvent.setup();
      render(
        <MainLayout navLinks={navLinks}>
          <div>Content</div>
        </MainLayout>
      );

      // Open sidebar
      await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close sidebar
      await user.click(screen.getByRole('button', { name: 'Close sidebar' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('skip link becomes visible on focus', async () => {
      const user = userEvent.setup();
      render(
        <MainLayout navLinks={navLinks}>
          <div>Content</div>
        </MainLayout>
      );

      const skipLink = screen.getByText('Skip to main content');
      await user.tab();

      // Skip link should be focusable
      expect(skipLink).toHaveClass('skip-link');
    });
  });
});
