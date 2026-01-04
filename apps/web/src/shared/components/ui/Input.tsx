import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

export type InputState = 'default' | 'error' | 'success';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  state?: InputState;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  floatingLabel?: boolean;
}

const stateStyles: Record<InputState, string> = {
  default:
    'border-neutral-700 focus:border-primary-500 focus:ring-primary-500/20 bg-neutral-900/50 text-neutral-100 placeholder:text-neutral-500',
  error:
    'border-error-500 focus:border-error-500 focus:ring-error-500/20 bg-neutral-900/50 text-neutral-100 placeholder:text-neutral-500',
  success:
    'border-success-500 focus:border-success-500 focus:ring-success-500/20 bg-neutral-900/50 text-neutral-100 placeholder:text-neutral-500',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      errorMessage,
      state = 'default',
      leftIcon,
      rightIcon,
      floatingLabel = false,
      className,
      id,
      disabled,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;
    const actualState = errorMessage ? 'error' : state;

    const describedBy = [
      ariaDescribedBy,
      helperText ? helperId : null,
      errorMessage ? errorId : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="w-full">
        {floatingLabel && label ? (
          <div className="relative">
            {leftIcon && (
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500 z-10">
                {leftIcon}
              </div>
            )}
            <input
              ref={ref}
              id={inputId}
              disabled={disabled}
              placeholder=" "
              aria-invalid={actualState === 'error'}
              aria-describedby={describedBy || undefined}
              className={clsx(
                'peer block w-full rounded-lg border px-4 pt-6 pb-2 shadow-sm',
                'transition-all duration-250 ease-smooth',
                'placeholder:text-transparent placeholder:opacity-0',
                'focus:outline-none focus:ring-2 focus:ring-offset-0',
                'disabled:cursor-not-allowed disabled:opacity-50',
                stateStyles[actualState],
                leftIcon && 'pl-10',
                rightIcon && 'pr-10',
                errorMessage && 'animate-shake',
                className
              )}
              {...props}
            />
            <label
              htmlFor={inputId}
              className={clsx(
                'absolute left-4 top-4 text-neutral-500 transition-all duration-200 pointer-events-none',
                'peer-placeholder-shown:top-4 peer-placeholder-shown:text-base',
                'peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary-400',
                'peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs',
                leftIcon && 'left-10'
              )}
            >
              {label}
            </label>
            {rightIcon && (
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 z-10">
                {rightIcon}
              </div>
            )}
          </div>
        ) : (
          <>
            {label && (
              <label htmlFor={inputId} className="block text-sm font-medium text-neutral-300 mb-2">
                {label}
              </label>
            )}
            <div className="relative">
              {leftIcon && (
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                  {leftIcon}
                </div>
              )}
              <input
                ref={ref}
                id={inputId}
                disabled={disabled}
                aria-invalid={actualState === 'error'}
                aria-describedby={describedBy || undefined}
                className={clsx(
                  'block w-full rounded-lg border px-4 py-2.5 shadow-sm',
                  'transition-all duration-250 ease-smooth',
                  'focus:outline-none focus:ring-2 focus:ring-offset-0',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  stateStyles[actualState],
                  leftIcon && 'pl-10',
                  rightIcon && 'pr-10',
                  errorMessage && 'animate-shake',
                  className
                )}
                {...props}
              />
              {rightIcon && (
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  {rightIcon}
                </div>
              )}
            </div>
          </>
        )}

        {helperText && !errorMessage && (
          <p id={helperId} className="mt-2 text-sm text-neutral-500">
            {helperText}
          </p>
        )}

        {errorMessage && (
          <p id={errorId} className="mt-2 text-sm text-error-500" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
