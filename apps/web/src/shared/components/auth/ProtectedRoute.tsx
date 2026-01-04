/**
 * ProtectedRoute component
 * Checks auth state and redirects to login if not authenticated
 * Requirements: 7.3
 */
import { type ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSaasMode } from '@/config/env';
import { FullPageLoader } from '@/shared/components/feedback/LoadingSpinner';

export interface ProtectedRouteProps {
  /** Content to render when authenticated */
  children: ReactNode;
  /** Custom redirect path (defaults to /login) */
  redirectTo?: string;
  /** Whether to require auth even in self-hosted mode */
  requireAuthInSelfHosted?: boolean;
}

/**
 * ProtectedRoute wrapper component
 * Redirects to login if user is not authenticated in SaaS mode
 * Requirements: 7.3
 */
export function ProtectedRoute({
  children,
  redirectTo = '/login',
  requireAuthInSelfHosted = false,
}: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Determine if auth is required based on mode
  const requiresAuth = isSaasMode() || requireAuthInSelfHosted;

  useEffect(() => {
    // Skip auth check if not required
    if (!requiresAuth) {
      return;
    }

    // Wait for auth state to be determined
    if (isLoading) {
      return;
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate({
        to: redirectTo,
        search: { redirect: location.pathname },
      });
    }
  }, [isAuthenticated, isLoading, requiresAuth, navigate, redirectTo, location.pathname]);

  // Show loading while checking auth
  if (requiresAuth && isLoading) {
    return <FullPageLoader label="Checking authentication..." />;
  }

  // In self-hosted mode without requireAuthInSelfHosted, always render children
  if (!requiresAuth) {
    return <>{children}</>;
  }

  // Don't render protected content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Higher-order component for protecting routes
 * Usage: export default withProtectedRoute(MyPage)
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

/**
 * Hook to check if current route requires authentication
 * Useful for conditional rendering based on auth requirements
 */
export function useRequiresAuth(requireAuthInSelfHosted = false): boolean {
  return isSaasMode() || requireAuthInSelfHosted;
}
