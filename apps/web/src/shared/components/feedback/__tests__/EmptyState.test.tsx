import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import {
  EmptyState,
  NoResultsEmptyState,
  NoDataEmptyState,
  ErrorEmptyState,
} from '../EmptyState';
import { Button } from '../../ui/Button';

expect.extend({ toHaveNoViolations });

describe('EmptyState', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <EmptyState title="No items" description="Get started by creating one" />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with action', async () => {
      const { container } = render(
        <EmptyState
          title="No items"
          description="Get started by creating one"
          action={<Button>Create item</Button>}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('renders title', () => {
      render(<EmptyState title="No items found" />);
      expect(screen.getByRole('heading', { name: 'No items found' })).toBeInTheDocument();
    });

    it('renders description', () => {
      render(
        <EmptyState title="No items" description="Create your first item" />
      );
      expect(screen.getByText('Create your first item')).toBeInTheDocument();
    });

    it('renders custom icon', () => {
      render(
        <EmptyState
          title="No items"
          icon={<span data-testid="custom-icon">🎉</span>}
        />
      );
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('renders action slot', () => {
      render(
        <EmptyState
          title="No items"
          action={<Button>Add item</Button>}
        />
      );
      expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument();
    });
  });
});

describe('NoResultsEmptyState', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<NoResultsEmptyState />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('renders default message', () => {
      render(<NoResultsEmptyState />);
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });

    it('includes search term in message', () => {
      render(<NoResultsEmptyState searchTerm="test query" />);
      expect(screen.getByText(/No results found for "test query"/)).toBeInTheDocument();
    });

    it('renders clear button when onClear provided', () => {
      render(<NoResultsEmptyState onClear={() => {}} />);
      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onClear when clear button clicked', async () => {
      const user = userEvent.setup();
      const handleClear = vi.fn();
      render(<NoResultsEmptyState onClear={handleClear} />);

      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(handleClear).toHaveBeenCalled();
    });
  });
});

describe('NoDataEmptyState', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<NoDataEmptyState />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('renders with default entity name', () => {
      render(<NoDataEmptyState />);
      expect(screen.getByText('No items yet')).toBeInTheDocument();
    });

    it('renders with custom entity name', () => {
      render(<NoDataEmptyState entityName="scans" />);
      expect(screen.getByText('No scans yet')).toBeInTheDocument();
    });

    it('renders action when provided', () => {
      render(<NoDataEmptyState action={<Button>Create scan</Button>} />);
      expect(screen.getByRole('button', { name: 'Create scan' })).toBeInTheDocument();
    });
  });
});

describe('ErrorEmptyState', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<ErrorEmptyState />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('renders default error message', () => {
      render(<ErrorEmptyState />);
      expect(screen.getByText('Error loading data')).toBeInTheDocument();
    });

    it('renders custom error message', () => {
      render(<ErrorEmptyState message="Failed to load scans" />);
      expect(screen.getByText('Failed to load scans')).toBeInTheDocument();
    });

    it('renders retry button when onRetry provided', () => {
      render(<ErrorEmptyState onRetry={() => {}} />);
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onRetry when retry button clicked', async () => {
      const user = userEvent.setup();
      const handleRetry = vi.fn();
      render(<ErrorEmptyState onRetry={handleRetry} />);

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(handleRetry).toHaveBeenCalled();
    });
  });
});
