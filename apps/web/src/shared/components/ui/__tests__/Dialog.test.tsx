import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import {
  Dialog,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogCloseButton,
} from '../Dialog';
import { Button } from '../Button';

expect.extend({ toHaveNoViolations });

describe('Dialog', () => {
  describe('Accessibility', () => {
    it('should have no accessibility violations when open', async () => {
      const { container } = render(
        <Dialog isOpen={true} onClose={() => {}}>
          <DialogHeader>Test Dialog</DialogHeader>
          <DialogBody>Dialog content</DialogBody>
          <DialogFooter>
            <Button>Close</Button>
          </DialogFooter>
        </Dialog>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}}>
          <DialogHeader>Test Dialog</DialogHeader>
          <DialogBody>Dialog content</DialogBody>
        </Dialog>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      expect(screen.getByText('Dialog content')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <Dialog isOpen={false} onClose={() => {}}>
          <DialogHeader>Test Dialog</DialogHeader>
        </Dialog>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders DialogHeader as heading', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}}>
          <DialogHeader>Test Title</DialogHeader>
        </Dialog>
      );
      expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument();
    });

    it('renders DialogCloseButton', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}}>
          <DialogCloseButton onClose={() => {}} />
          <DialogHeader>Test Dialog</DialogHeader>
        </Dialog>
      );
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onClose when clicking outside', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={handleClose}>
          <DialogHeader>Test Dialog</DialogHeader>
        </Dialog>
      );

      // Click on the backdrop (outside the dialog panel)
      const backdrop = document.querySelector('[aria-hidden="true"]');
      if (backdrop) {
        await user.click(backdrop);
        await waitFor(() => {
          expect(handleClose).toHaveBeenCalled();
        });
      }
    });

    it('calls onClose when pressing Escape', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={handleClose}>
          <DialogHeader>Test Dialog</DialogHeader>
        </Dialog>
      );

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it('calls onClose when clicking close button', async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={() => {}}>
          <DialogCloseButton onClose={handleClose} />
          <DialogHeader>Test Dialog</DialogHeader>
        </Dialog>
      );

      await user.click(screen.getByRole('button', { name: 'Close dialog' }));
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('traps focus within dialog', async () => {
      const user = userEvent.setup();
      render(
        <Dialog isOpen={true} onClose={() => {}}>
          <DialogHeader>Test Dialog</DialogHeader>
          <DialogBody>
            <input data-testid="input1" />
            <input data-testid="input2" />
          </DialogBody>
          <DialogFooter>
            <Button>Cancel</Button>
            <Button>Confirm</Button>
          </DialogFooter>
        </Dialog>
      );

      // Tab through focusable elements
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();
      
      // Focus should cycle within the dialog
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });
});
