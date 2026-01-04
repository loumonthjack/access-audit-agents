import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-primary-400 disabled:from-primary-300 disabled:to-primary-300',
  secondary:
    'bg-neutral-800 text-neutral-100 border border-neutral-700 shadow-sm hover:bg-neutral-700 hover:border-neutral-600 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-neutral-400',
  ghost:
    'bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100',
  danger:
    'bg-gradient-to-br from-error-600 to-error-700 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-error-400 disabled:from-error-300 disabled:to-error-300',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={clsx(
          'inline-flex items-center justify-center rounded-lg font-medium',
          'transition-all duration-250 ease-smooth',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="h-4 w-4 animate-spin"
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
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
