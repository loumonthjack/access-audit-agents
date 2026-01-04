/**
 * ModeIndicator Component
 * Displays "Self-Hosted Mode" badge when in self-hosted deployment
 * Requirements: 8.4
 */
import { Badge } from '@/shared/components/ui/Badge';
import { env, isSelfHostedMode } from '@/config/env';

/**
 * Props for ModeIndicator component
 */
export interface ModeIndicatorProps {
  /** Force show the indicator (for testing) */
  forceShow?: boolean;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Server icon SVG component
 */
function ServerIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm14 1a1 1 0 11-2 0 1 1 0 012 0zM2 13a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2zm14 1a1 1 0 11-2 0 1 1 0 012 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * ModeIndicator component
 * Shows a badge indicating self-hosted mode
 * Only visible when running in self-hosted deployment mode
 * Requirements: 8.4
 */
export function ModeIndicator({ forceShow = false, className = '' }: ModeIndicatorProps) {
  // Only show in self-hosted mode (or when forced for testing)
  if (!forceShow && !isSelfHostedMode()) {
    return null;
  }

  return (
    <Badge
      variant="default"
      size="sm"
      className={`inline-flex items-center gap-1.5 ${className}`}
      data-testid="mode-indicator"
      aria-label="Self-Hosted Mode"
    >
      <ServerIcon />
      <span>Self-Hosted Mode</span>
    </Badge>
  );
}

/**
 * Hook to check current deployment mode
 * Useful for conditional rendering based on mode
 */
export function useDeploymentMode() {
  return {
    mode: env.authMode,
    isSelfHosted: isSelfHostedMode(),
    isSaaS: env.authMode === 'saas',
  };
}
