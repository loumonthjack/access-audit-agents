import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'critical'
  | 'serious'
  | 'moderate'
  | 'minor';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-100/80 text-neutral-700 ring-1 ring-neutral-200/50',
  primary: 'bg-primary-100/80 text-primary-700 ring-1 ring-primary-200/50',
  success: 'bg-success-100/80 text-success-700 ring-1 ring-success-200/50',
  warning: 'bg-warning-100/80 text-warning-700 ring-1 ring-warning-200/50',
  error: 'bg-error-100/80 text-error-700 ring-1 ring-error-200/50',
  // Impact level variants for accessibility violations
  critical: 'bg-error-100/80 text-error-700 ring-1 ring-error-200/50',
  serious: 'bg-warning-100/80 text-warning-700 ring-1 ring-warning-200/50',
  moderate: 'bg-primary-100/80 text-primary-700 ring-1 ring-primary-200/50',
  minor: 'bg-neutral-100/80 text-neutral-600 ring-1 ring-neutral-200/50',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-sm',
  lg: 'px-2.5 py-1 text-sm',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', children, className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center rounded-full font-medium shadow-sm',
          'transition-all duration-200 ease-smooth',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
