import { Fragment, useId, type ReactNode } from 'react';
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from '@headlessui/react';
import { clsx } from 'clsx';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T = string> {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  errorMessage?: string;
  helperText?: string;
  className?: string;
  id?: string;
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Select<T = string>({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  errorMessage,
  helperText,
  className,
  id,
}: SelectProps<T>): ReactNode {
  const generatedId = useId();
  const selectId = id || generatedId;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label
          id={`${selectId}-label`}
          className="mb-2 block text-sm font-medium text-neutral-300"
        >
          {label}
        </label>
      )}
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <ListboxButton
            id={selectId}
            aria-labelledby={label ? `${selectId}-label` : undefined}
            aria-describedby={
              [helperText ? helperId : null, errorMessage ? errorId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            aria-invalid={!!errorMessage}
            className={clsx(
              'relative w-full cursor-pointer rounded-lg border py-2.5 pl-3 pr-10 text-left shadow-sm',
              'transition-all duration-250 ease-smooth',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'disabled:cursor-not-allowed disabled:opacity-50',
              errorMessage
                ? 'border-error-500 focus:border-error-500 focus:ring-error-500/20 bg-neutral-900/50 text-neutral-100'
                : 'border-neutral-700 focus:border-primary-500 focus:ring-primary-500/20 bg-neutral-900/50 text-neutral-100'
            )}
          >
            <span
              className={clsx(
                'block truncate',
                !selectedOption && 'text-neutral-500'
              )}
            >
              {selectedOption?.label || placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronIcon className="h-5 w-5 text-neutral-500" />
            </span>
          </ListboxButton>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <ListboxOptions className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-neutral-900 border border-neutral-800 py-1 shadow-lg focus:outline-none">
              {options.map((option) => (
                <ListboxOption
                  key={String(option.value)}
                  value={option.value}
                  disabled={option.disabled}
                  className={({ active, selected, disabled }) =>
                    clsx(
                      'relative cursor-pointer select-none py-2 pl-10 pr-4',
                      'text-neutral-200',
                      active && 'bg-primary-500/10 text-primary-400',
                      selected && !active && 'bg-neutral-800',
                      disabled && 'cursor-not-allowed opacity-50'
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span
                        className={clsx(
                          'block truncate',
                          selected ? 'font-medium' : 'font-normal'
                        )}
                      >
                        {option.label}
                      </span>
                      {selected && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-500">
                          <CheckIcon className="h-5 w-5" />
                        </span>
                      )}
                    </>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
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
