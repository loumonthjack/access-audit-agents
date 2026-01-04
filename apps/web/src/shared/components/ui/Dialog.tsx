import { Fragment, type ReactNode } from 'react';
import {
  Dialog as HeadlessDialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { clsx } from 'clsx';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  initialFocus?: React.RefObject<HTMLElement | null>;
}

export function Dialog({
  isOpen,
  onClose,
  children,
  initialFocus,
}: DialogProps) {
  return (
    <Transition show={isOpen} as={Fragment}>
      <HeadlessDialog
        as="div"
        className="relative z-50"
        onClose={onClose}
        initialFocus={initialFocus}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-black/25 backdrop-blur-sm"
            aria-hidden="true"
          />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                {children}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  );
}

export interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <DialogTitle
      as="h3"
      className={clsx('text-lg font-semibold text-neutral-900', className)}
    >
      {children}
    </DialogTitle>
  );
}

export interface DialogBodyProps {
  children: ReactNode;
  className?: string;
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return <div className={clsx('mt-4', className)}>{children}</div>;
}

export interface DialogFooterProps {
  children: ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={clsx('mt-6 flex justify-end gap-3', className)}>
      {children}
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

export interface DialogCloseButtonProps {
  onClose: () => void;
  className?: string;
}

export function DialogCloseButton({
  onClose,
  className,
}: DialogCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={clsx(
        'absolute right-4 top-4 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-500',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
        className
      )}
      aria-label="Close dialog"
    >
      <CloseIcon className="h-5 w-5" />
    </button>
  );
}
