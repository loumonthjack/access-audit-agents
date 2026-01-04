import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { Select, type SelectOption } from '../Select';

expect.extend({ toHaveNoViolations });

const options: SelectOption[] = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
];

describe('Select', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <Select label="Viewport" value="mobile" onChange={() => {}} options={options} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with error', async () => {
      const { container } = render(
        <Select
          label="Viewport"
          value="mobile"
          onChange={() => {}}
          options={options}
          errorMessage="Please select a viewport"
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('renders with label', () => {
      render(<Select label="Viewport" value="mobile" onChange={() => {}} options={options} />);
      expect(screen.getByText('Viewport')).toBeInTheDocument();
    });

    it('displays selected option', () => {
      render(<Select label="Viewport" value="desktop" onChange={() => {}} options={options} />);
      expect(screen.getByRole('button')).toHaveTextContent('Desktop');
    });

    it('displays placeholder when no value selected', () => {
      render(
        <Select
          label="Viewport"
          value=""
          onChange={() => {}}
          options={options}
          placeholder="Choose viewport"
        />
      );
      expect(screen.getByRole('button')).toHaveTextContent('Choose viewport');
    });

    it('renders error message', () => {
      render(
        <Select
          label="Viewport"
          value=""
          onChange={() => {}}
          options={options}
          errorMessage="Required field"
        />
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Required field');
    });

    it('renders helper text', () => {
      render(
        <Select
          label="Viewport"
          value="mobile"
          onChange={() => {}}
          options={options}
          helperText="Select the device viewport"
        />
      );
      expect(screen.getByText('Select the device viewport')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('opens dropdown on click', async () => {
      const user = userEvent.setup();
      render(<Select label="Viewport" value="mobile" onChange={() => {}} options={options} />);

      await user.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('calls onChange when option is selected', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Select label="Viewport" value="mobile" onChange={handleChange} options={options} />);

      await user.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      await user.click(screen.getByRole('option', { name: 'Desktop' }));
      expect(handleChange).toHaveBeenCalledWith('desktop');
    });

    it('does not open when disabled', async () => {
      const user = userEvent.setup();
      render(
        <Select label="Viewport" value="mobile" onChange={() => {}} options={options} disabled />
      );

      await user.click(screen.getByRole('button'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('can be focused with Tab', async () => {
      const user = userEvent.setup();
      render(<Select label="Viewport" value="mobile" onChange={() => {}} options={options} />);

      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();
    });

    it('opens dropdown with Space', async () => {
      const user = userEvent.setup();
      render(<Select label="Viewport" value="mobile" onChange={() => {}} options={options} />);

      await user.tab();
      await user.keyboard(' ');
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('closes dropdown with Escape', async () => {
      const user = userEvent.setup();
      render(<Select label="Viewport" value="mobile" onChange={() => {}} options={options} />);

      await user.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });
});
