/**
 * Root layout component
 * Wraps all routes with providers and layout components
 * Requirements: 7.3, 10.1
 */
import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/config/queryClient';
import { AuthProvider } from '@/features/auth/providers/AuthProvider';
import { MainLayout } from '@/shared/components/layout/MainLayout';
import { ConnectionBanner } from '@/shared/components/feedback/ConnectionBanner';
import { ErrorBoundary } from '@/shared/components/layout/ErrorBoundary';
import { UserMenu } from '@/features/auth/components/UserMenu';
import { ModeIndicator } from '@/features/auth/components/ModeIndicator';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useApiAuth } from '@/features/auth/hooks/useApiAuth';
import { useConnectionStore } from '@/shared/store/connectionStore';
import { isProtectedRoute } from '@/config/router';
import type { NavItem } from '@/shared/components/layout/Sidebar';

/**
 * Navigation items for the sidebar
 */
const navItems: NavItem[] = [
    {
        id: 'home',
        label: 'New Scan',
        href: '/',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        ),
    },
    {
        id: 'batch',
        label: 'Batch Scan',
        href: '/batch',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
        ),
    },
    {
        id: 'history',
        label: 'History',
        href: '/history',
        icon: (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    },
];

/**
 * Get navigation items with active state based on current path
 */
function useNavItems(): NavItem[] {
    const location = useLocation();
    const pathname = location.pathname;

    return navItems.map((item) => ({
        ...item,
        active: item.href === '/' 
            ? pathname === '/' 
            : pathname.startsWith(item.href),
    }));
}

/**
 * User menu component that uses auth context
 */
function AuthenticatedUserMenu() {
    const { user, isAuthenticated, logout, isLoading } = useAuth();

    if (!isAuthenticated || !user) {
        return null;
    }

    return (
        <UserMenu
            user={user}
            onLogout={logout}
            isLoading={isLoading}
        />
    );
}

/**
 * Sidebar footer with mode indicator
 */
function SidebarFooter() {
    return (
        <div className="flex items-center justify-center">
            <ModeIndicator />
        </div>
    );
}

/**
 * Connection banner with retry functionality
 */
function ConnectionStatusBanner() {
    const { setApiStatus, setWsStatus } = useConnectionStore();

    const handleRetry = () => {
        // Reset connection status to trigger reconnection
        setApiStatus('connected');
        setWsStatus('connecting');
        // Reload the page to re-establish connections
        window.location.reload();
    };

    return <ConnectionBanner onRetry={handleRetry} />;
}

/**
 * Auth guard component that redirects to login if not authenticated
 * Saves the current URL to redirect back after login
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const pathname = location.pathname;

    useEffect(() => {
        // Don't redirect while loading auth state
        if (isLoading) return;

        // Check if current route requires authentication
        if (isProtectedRoute(pathname) && !isAuthenticated) {
            // Save current URL and redirect to login
            const redirectUrl = pathname + (location.search || '');
            navigate({ 
                to: '/login', 
                search: { redirect: redirectUrl },
                replace: true 
            });
        }
    }, [isAuthenticated, isLoading, pathname, location.search, navigate]);

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-neutral-950">
                <div className="text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent mx-auto" />
                    <p className="text-neutral-400">Loading...</p>
                </div>
            </div>
        );
    }

    // If route is protected and user is not authenticated, don't render children
    // (redirect will happen in useEffect)
    if (isProtectedRoute(pathname) && !isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}

/**
 * Inner layout component that uses auth context
 * Must be inside AuthProvider
 */
function AppLayout() {
    const items = useNavItems();
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    
    // Configure API client with auth token
    useApiAuth();

    // Hide header on public pages when not authenticated
    const isLoginPage = location.pathname === '/login';
    const hideHeader = !isAuthenticated || isLoginPage;

    return (
        <AuthGuard>
            <MainLayout
                navItems={items}
                userMenu={<AuthenticatedUserMenu />}
                sidebarFooter={<SidebarFooter />}
                banner={<ConnectionStatusBanner />}
                hideHeader={hideHeader}
            >
                <Outlet />
            </MainLayout>
        </AuthGuard>
    );
}

/**
 * Root layout wrapping all routes
 * Provides QueryClient, Auth, and Layout
 * Requirements: 7.3, 10.1
 */
export function RootLayout() {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <AppLayout />
                </AuthProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}

export default RootLayout;
