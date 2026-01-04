import { clsx } from 'clsx';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface LoadingSpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
  showLabel?: boolean;
}

const sizeStyles: Record<SpinnerSize, { spinner: string; text: string }> = {
  sm: { spinner: 'h-4 w-4', text: 'text-xs' },
  md: { spinner: 'h-6 w-6', text: 'text-sm' },
  lg: { spinner: 'h-8 w-8', text: 'text-base' },
  xl: { spinner: 'h-12 w-12', text: 'text-lg' },
};

export function LoadingSpinner({
  size = 'md',
  label = 'Loading...',
  className,
  showLabel = true,
}: LoadingSpinnerProps) {
  const { spinner, text } = sizeStyles[size];

  return (
    <div
      className={clsx('flex flex-col items-center justify-center gap-3', className)}
      role="status"
      aria-live="polite"
    >
      <svg
        className={clsx('animate-spin text-primary-600', spinner)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {showLabel ? (
        <span className={clsx('text-neutral-600', text)}>{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  );
}

export interface FullPageLoaderProps {
  label?: string;
}

export function FullPageLoader({ label = 'Loading...' }: FullPageLoaderProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <LoadingSpinner size="lg" label={label} />
    </div>
  );
}

export interface InlineLoaderProps {
  label?: string;
  className?: string;
}

export function InlineLoader({
  label = 'Loading...',
  className,
}: InlineLoaderProps) {
  return (
    <span
      className={clsx('inline-flex items-center gap-2', className)}
      role="status"
      aria-live="polite"
    >
      <svg
        className="h-4 w-4 animate-spin text-primary-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="text-sm text-neutral-600">{label}</span>
    </span>
  );
}
