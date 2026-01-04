import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import { LoadingSpinner, FullPageLoader, InlineLoader } from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<LoadingSpinner />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has status role for screen readers', () => {
      render(<LoadingSpinner />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has aria-live for dynamic updates', () => {
      render(<LoadingSpinner />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Rendering', () => {
    it('renders with default label', () => {
      render(<LoadingSpinner />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      render(<LoadingSpinner label="Fetching data..." />);
      expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    });

    it('hides label visually when showLabel is false', () => {
      render(<LoadingSpinner showLabel={false} />);
      expect(screen.getByText('Loading...')).toHaveClass('sr-only');
    });

    it('renders all sizes', () => {
      const { rerender } = render(<LoadingSpinner size="sm" />);
      expect(screen.getByRole('status').querySelector('svg')).toHaveClass('h-4', 'w-4');

      rerender(<LoadingSpinner size="md" />);
      expect(screen.getByRole('status').querySelector('svg')).toHaveClass('h-6', 'w-6');

      rerender(<LoadingSpinner size="lg" />);
      expect(screen.getByRole('status').querySelector('svg')).toHaveClass('h-8', 'w-8');

      rerender(<LoadingSpinner size="xl" />);
      expect(screen.getByRole('status').querySelector('svg')).toHaveClass('h-12', 'w-12');
    });
  });
});

describe('FullPageLoader', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<FullPageLoader />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('renders with default label', () => {
      render(<FullPageLoader />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      render(<FullPageLoader label="Loading page..." />);
      expect(screen.getByText('Loading page...')).toBeInTheDocument();
    });

    it('uses large spinner size', () => {
      render(<FullPageLoader />);
      expect(screen.getByRole('status').querySelector('svg')).toHaveClass('h-8', 'w-8');
    });
  });
});

describe('InlineLoader', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<InlineLoader />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has status role', () => {
      render(<InlineLoader />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('renders with default label', () => {
      render(<InlineLoader />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      render(<InlineLoader label="Saving..." />);
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });
  });
});
