import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { Button } from '../Button';

expect.extend({ toHaveNoViolations });

describe('Button', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<Button>Click me</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations when disabled', async () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations when loading', async () => {
      const { container } = render(<Button isLoading>Loading</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('renders with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders all variants', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('from-primary-600');

      rerender(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-neutral-800');

      rerender(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-transparent');

      rerender(<Button variant="danger">Danger</Button>);
      expect(screen.getByRole('button')).toHaveClass('from-error-600');
    });

    it('renders all sizes', () => {
      const { rerender } = render(<Button size="sm">Small</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-3', 'py-1.5', 'text-sm');

      rerender(<Button size="md">Medium</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2.5', 'text-base');

      rerender(<Button size="lg">Large</Button>);
      expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3', 'text-lg');
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Click me</Button>);

      await user.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} isLoading>Click me</Button>);

      await user.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('can be focused with Tab', async () => {
      const user = userEvent.setup();
      render(<Button>Click me</Button>);

      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();
    });

    it('can be activated with Enter', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      await user.tab();
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('can be activated with Space', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      await user.tab();
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('is disabled when loading', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});
