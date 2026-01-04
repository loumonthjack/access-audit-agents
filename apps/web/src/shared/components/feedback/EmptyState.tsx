import { type ReactNode } from 'react';
import { clsx } from 'clsx';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

function DefaultIcon() {
  return (
    <svg
      className="h-12 w-12 text-neutral-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="mb-4">{icon || <DefaultIcon />}</div>
      <h3 className="text-lg font-medium text-neutral-900">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-neutral-500">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// Pre-built empty state variants for common use cases

export interface NoResultsEmptyStateProps {
  searchTerm?: string;
  onClear?: () => void;
}

export function NoResultsEmptyState({
  searchTerm,
  onClear,
}: NoResultsEmptyStateProps) {
  return (
    <EmptyState
      icon={
        <svg
          className="h-12 w-12 text-neutral-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      }
      title="No results found"
      description={
        searchTerm
          ? `No results found for "${searchTerm}". Try adjusting your search.`
          : 'No results match your current filters.'
      }
      action={
        onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
          >
            Clear filters
          </button>
        )
      }
    />
  );
}

export interface NoDataEmptyStateProps {
  entityName?: string;
  action?: ReactNode;
}

export function NoDataEmptyState({
  entityName = 'items',
  action,
}: NoDataEmptyStateProps) {
  return (
    <EmptyState
      icon={
        <svg
          className="h-12 w-12 text-neutral-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
          />
        </svg>
      }
      title={`No ${entityName} yet`}
      description={`Get started by creating your first ${entityName.replace(/s$/, '')}.`}
      action={action}
    />
  );
}

export interface ErrorEmptyStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorEmptyState({
  message = 'Something went wrong while loading the data.',
  onRetry,
}: ErrorEmptyStateProps) {
  return (
    <EmptyState
      icon={
        <svg
          className="h-12 w-12 text-error-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      }
      title="Error loading data"
      description={message}
      action={
        onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded"
          >
            Try again
          </button>
        )
      }
    />
  );
}
