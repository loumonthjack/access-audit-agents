/**
 * DeleteConfirmDialog component
 * Confirmation modal for deleting a scan session
 * Requirements: 6.4
 */
import { useRef } from 'react';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/shared/components/ui/Dialog';
import { Button } from '@/shared/components/ui/Button';
import type { DeleteConfirmDialogProps } from '../types';

/**
 * Warning icon component
 */
function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * DeleteConfirmDialog component
 * Requirements: 6.4
 */
export function DeleteConfirmDialog({
  isOpen,
  sessionUrl,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} initialFocus={cancelButtonRef}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-error-100">
          <WarningIcon className="h-6 w-6 text-error-600" />
        </div>
        <div className="flex-1">
          <DialogHeader>Delete Scan Session</DialogHeader>
          <DialogBody className="mt-2">
            <p className="text-sm text-neutral-500">
              Are you sure you want to delete this scan session? This action cannot be undone.
            </p>
            <p className="mt-2 text-sm font-medium text-neutral-700 truncate">{sessionUrl}</p>
          </DialogBody>
        </div>
      </div>
      <DialogFooter>
        <Button ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Delete
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
