import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import 'vitest-axe/extend-expect';
import { Input } from '../Input';

describe('Input', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations with label', async () => {
      const { container } = render(<Input label="Email" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with error', async () => {
      const { container } = render(<Input label="Email" errorMessage="Invalid email" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations when disabled', async () => {
      const { container } = render(<Input label="Email" disabled />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('renders with label', () => {
      render(<Input label="Email" />);
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter email" />);
      expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    });

    it('renders helper text', () => {
      render(<Input label="Email" helperText="We'll never share your email" />);
      expect(screen.getByText("We'll never share your email")).toBeInTheDocument();
    });

    it('renders error message', () => {
      render(<Input label="Email" errorMessage="Invalid email" />);
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
    });

    it('hides helper text when error is shown', () => {
      render(<Input label="Email" helperText="Helper text" errorMessage="Error message" />);
      expect(screen.queryByText('Helper text')).not.toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('Validation States', () => {
    it('applies error styles when errorMessage is provided', () => {
      render(<Input label="Email" errorMessage="Invalid" />);
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveClass('border-error-500');
    });

    it('applies success styles when state is success', () => {
      render(<Input label="Email" state="success" />);
      const input = screen.getByLabelText('Email');
      expect(input).toHaveClass('border-success-500');
    });
  });

  describe('Interactions', () => {
    it('calls onChange when typing', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Input label="Email" onChange={handleChange} />);

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      expect(handleChange).toHaveBeenCalled();
    });

    it('does not allow input when disabled', async () => {
      const user = userEvent.setup();
      render(<Input label="Email" disabled />);

      const input = screen.getByLabelText('Email');
      await user.type(input, 'test');
      expect(input).toHaveValue('');
    });
  });

  describe('Keyboard Navigation', () => {
    it('can be focused with Tab', async () => {
      const user = userEvent.setup();
      render(<Input label="Email" />);

      await user.tab();
      expect(screen.getByLabelText('Email')).toHaveFocus();
    });
  });

  describe('ARIA Attributes', () => {
    it('links input to error message via aria-describedby', () => {
      render(<Input label="Email" id="email" errorMessage="Invalid" />);
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
    });

    it('links input to helper text via aria-describedby', () => {
      render(<Input label="Email" id="email" helperText="Help text" />);
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('helper'));
    });
  });
});
