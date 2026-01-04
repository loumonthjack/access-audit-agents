/* eslint-disable react-refresh/only-export-components */
/**
 * TanStack Router configuration
 * Type-safe routing with route loaders and error handling
 */
import {
  createRouter,
  createRootRoute,
  createRoute,
  NotFoundRoute,
  ErrorComponent,
} from '@tanstack/react-router';
import { RootLayout } from '@/routes/__root';
import { HomePage } from '@/routes/index';
import { ScanPage } from '@/routes/scan/$sessionId';
import { HistoryPage } from '@/routes/history/index';
import { ReportPage } from '@/routes/report/$sessionId';
import { LoginPage } from '@/routes/login';
import { BatchPage } from '@/routes/batch/index';
import { BatchProgressPage } from '@/routes/batch/$batchId';
import { BatchReportPage } from '@/routes/batch/$batchId/report';
import { isSaasMode } from '@/config/env';

/**
 * Route parameter types for type-safe routing
 */
export interface ScanRouteParams {
  sessionId: string;
}

export interface ReportRouteParams {
  sessionId: string;
}

export interface BatchRouteParams {
  batchId: string;
}

/**
 * Error fallback component for route errors
 */
function RouteErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h1 className="mb-2 text-xl font-semibold text-red-600">Something went wrong</h1>
        <p className="mb-4 text-neutral-600">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Reload page
        </button>
      </div>
    </div>
  );
}

/**
 * Not found component for 404 routes
 */
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-6xl font-bold text-neutral-300">404</h1>
        <h2 className="mb-4 text-xl font-semibold text-neutral-700">Page not found</h2>
        <p className="mb-6 text-neutral-600">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

/**
 * Pending component shown during route loading
 */
function PendingComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
        <p className="text-neutral-600">Loading...</p>
      </div>
    </div>
  );
}

// Create the root route
const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: RouteErrorFallback as typeof ErrorComponent,
  pendingComponent: PendingComponent,
});

// Home page route (/)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  validateSearch: (search: Record<string, unknown>) => ({
    startScan: typeof search.startScan === 'string' ? search.startScan : undefined,
  }),
});

// Scan page route (/scan/:sessionId)
const scanRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scan/$sessionId',
  component: ScanPage,
  // Note: Loaders run before React components mount, so auth token isn't available
  // The component handles data fetching with proper auth context
});

// History page route (/history)
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  component: HistoryPage,
});

// Report page route (/report/:sessionId)
const reportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/report/$sessionId',
  component: ReportPage,
  // Note: Loaders run before React components mount, so auth token isn't available
  // The component handles data fetching with proper auth context
});

// Login page route (/login)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
});

// Batch scan initiation page route (/batch)
const batchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/batch',
  component: BatchPage,
  validateSearch: (search: Record<string, unknown>) => ({
    startScan: typeof search.startScan === 'string' ? search.startScan : undefined,
  }),
});

// Batch scan progress page route (/batch/:batchId)
const batchProgressRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/batch/$batchId',
  component: BatchProgressPage,
});

// Batch scan report page route (/batch/:batchId/report)
const batchReportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/batch/$batchId/report',
  component: BatchReportPage,
});

// Not found route
const notFoundRoute = new NotFoundRoute({
  getParentRoute: () => rootRoute,
  component: NotFoundComponent,
});

// Build the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  scanRoute,
  historyRoute,
  reportRoute,
  loginRoute,
  batchRoute,
  batchProgressRoute,
  batchReportRoute,
]);

// Create and export the router
export const router = createRouter({
  routeTree,
  notFoundRoute,
  defaultPreload: 'intent',
  defaultPendingComponent: PendingComponent,
  defaultErrorComponent: RouteErrorFallback as typeof ErrorComponent,
});

// Register router types for type-safe navigation
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Export route references for type-safe navigation
export const routes = {
  home: indexRoute,
  scan: scanRoute,
  history: historyRoute,
  report: reportRoute,
  login: loginRoute,
  batch: batchRoute,
  batchProgress: batchProgressRoute,
  batchReport: batchReportRoute,
} as const;

/**
 * Type-safe navigation helpers
 */
export const routePaths = {
  home: '/' as const,
  scan: (sessionId: string) => `/scan/${sessionId}` as const,
  history: '/history' as const,
  report: (sessionId: string) => `/report/${sessionId}` as const,
  login: '/login' as const,
  batch: '/batch' as const,
  batchProgress: (batchId: string) => `/batch/${batchId}` as const,
  batchReport: (batchId: string) => `/batch/${batchId}/report` as const,
} as const;

/**
 * Check if a route requires authentication
 * Used by components to determine if auth check is needed
 */
export function isProtectedRoute(pathname: string): boolean {
  // In SaaS mode, only certain routes are protected (not the home page)
  if (isSaasMode()) {
    // Home page is public - users can see the form
    if (pathname === '/') return false;
    // Login page is always public
    if (pathname === '/login') return false;
    // Batch scan initiation page is public - users can see the form
    if (pathname === '/batch') return false;
    // All other routes require auth
    return true;
  }
  // In self-hosted mode, no routes require auth by default
  return false;
}
