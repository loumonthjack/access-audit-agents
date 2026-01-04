import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '../ui/Button';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function DefaultErrorFallback({ error, onReset }: DefaultErrorFallbackProps) {
  return (
    <div
      className="flex min-h-[400px] flex-col items-center justify-center p-8"
      role="alert"
    >
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error-100">
          <svg
            className="h-8 w-8 text-error-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h2 className="mb-2 text-xl font-semibold text-neutral-900">
          Something went wrong
        </h2>

        <p className="mb-6 text-neutral-600">
          An unexpected error occurred. Please try again or contact support if
          the problem persists.
        </p>

        {error && (
          <details className="mb-6 rounded-md bg-neutral-100 p-4 text-left">
            <summary className="cursor-pointer text-sm font-medium text-neutral-700">
              Error details
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-neutral-600">
              {error.message}
              {error.stack && (
                <>
                  {'\n\n'}
                  {error.stack}
                </>
              )}
            </pre>
          </details>
        )}

        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Refresh page
          </Button>
          <Button onClick={onReset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}

export interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  showRefresh?: boolean;
}

export function ErrorFallback({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  showRefresh = true,
}: ErrorFallbackProps) {
  return (
    <div
      className="flex min-h-[300px] flex-col items-center justify-center p-8"
      role="alert"
    >
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-100">
          <svg
            className="h-6 w-6 text-error-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        <h3 className="mb-2 text-lg font-semibold text-neutral-900">{title}</h3>
        <p className="mb-6 text-sm text-neutral-600">{message}</p>

        <div className="flex justify-center gap-3">
          {showRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
          )}
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
