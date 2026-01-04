import { clsx } from 'clsx';
import { Button } from '../ui/Button';
import { useConnectionStore, type ApiStatus, type WsStatus } from '../../store/connectionStore';

export interface ConnectionBannerProps {
  onRetry?: () => void;
  className?: string;
}

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

function getOverallStatus(apiStatus: ApiStatus, wsStatus: WsStatus): ConnectionStatus {
  if (apiStatus === 'error') return 'error';
  if (apiStatus === 'disconnected') return 'disconnected';
  if (wsStatus === 'reconnecting' || wsStatus === 'connecting') return 'connecting';
  if (wsStatus === 'disconnected' && apiStatus === 'connected') return 'connected';
  return 'connected';
}

function getStatusMessage(
  apiStatus: ApiStatus,
  wsStatus: WsStatus,
  reconnectAttempt: number,
  lastError: string | null
): string {
  if (apiStatus === 'error') {
    return lastError || 'Unable to connect to the server';
  }
  if (apiStatus === 'disconnected') {
    return 'Connection to server lost';
  }
  if (wsStatus === 'reconnecting') {
    return `Reconnecting... (attempt ${reconnectAttempt})`;
  }
  if (wsStatus === 'connecting') {
    return 'Connecting to real-time updates...';
  }
  return '';
}

const statusStyles: Record<ConnectionStatus, string> = {
  connected: 'bg-success-50 border-success-200 text-success-800',
  connecting: 'bg-warning-50 border-warning-200 text-warning-800',
  disconnected: 'bg-error-50 border-error-200 text-error-800',
  error: 'bg-error-50 border-error-200 text-error-800',
};

const statusIcons: Record<ConnectionStatus, React.ReactNode> = {
  connected: (
    <svg
      className="h-5 w-5 text-success-500"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  ),
  connecting: (
    <svg
      className="h-5 w-5 animate-spin text-warning-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  ),
  disconnected: (
    <svg
      className="h-5 w-5 text-error-500"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg
      className="h-5 w-5 text-error-500"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

export function ConnectionBanner({ onRetry, className }: ConnectionBannerProps) {
  const { apiStatus, wsStatus, reconnectAttempt, lastError } = useConnectionStore();

  const overallStatus = getOverallStatus(apiStatus, wsStatus);
  const message = getStatusMessage(apiStatus, wsStatus, reconnectAttempt, lastError);

  // Don't show banner when fully connected
  if (overallStatus === 'connected') {
    return null;
  }

  return (
    <div
      className={clsx('border-b px-4 py-3', statusStyles[overallStatus], className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {statusIcons[overallStatus]}
          <span className="text-sm font-medium">{message}</span>
        </div>

        {(overallStatus === 'disconnected' || overallStatus === 'error') && onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
