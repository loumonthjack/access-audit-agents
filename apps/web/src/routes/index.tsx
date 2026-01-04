/**
 * Home page component
 * ScanForm integration with recent scans preview
 * Requirements: 1.1, 1.4
 */
import { useEffect, useRef, useState } from 'react';
import { ScanForm } from '@/features/scan/components/ScanForm';
import { SessionCard } from '@/features/history/components/SessionCard';
import { BatchSessionCard } from '@/features/batch-scan/components/BatchSessionCard';
import { useStartScan } from '@/features/scan/api/scanApi';
import { useSessionHistory } from '@/features/history/hooks/useSessionHistory';
import { useBatchScanHistory } from '@/features/batch-scan/api/batchApi';
import { Skeleton } from '@/shared/components/ui/Skeleton';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { Viewport } from '@/types/domain';

/**
 * Animated gradient orb for visual effect
 */
function GradientOrb({ className }: { className?: string }) {
    return (
        <div
            className={`absolute rounded-full blur-3xl opacity-20 animate-pulse ${className}`}
            style={{ animationDuration: '4s' }}
        />
    );
}

/**
 * Loading skeleton for recent scans
 */
function RecentScansSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div 
                    key={i} 
                    className="rounded-2xl border border-neutral-800/50 bg-gradient-to-r from-neutral-900/80 to-neutral-900/40 p-4 sm:p-5"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <Skeleton className="h-6 w-24 rounded-full bg-neutral-800/80" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full sm:w-64 bg-neutral-800/60" />
                            <Skeleton className="h-3 w-32 bg-neutral-800/40" />
                        </div>
                        <Skeleton className="h-9 w-20 rounded-lg bg-neutral-800/60" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Recent scans section showing last 3 sessions
 */
function RecentScans() {
    const navigate = useNavigate();
    const { data, isLoading } = useSessionHistory({ page: 1, limit: 3 });

    const handleView = (sessionId: string) => {
        navigate({ to: '/report/$sessionId', params: { sessionId } });
    };

    if (isLoading) {
        return <RecentScansSkeleton />;
    }

    const sessions = data?.data ?? [];

    if (sessions.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-neutral-700/50 bg-neutral-900/20 p-8 sm:p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700/50">
                        <svg className="h-8 w-8 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className="space-y-1">
                        <p className="text-base font-medium text-neutral-300">
                            No scans yet
                        </p>
                        <p className="text-sm text-neutral-500">
                            Start your first accessibility scan above!
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {sessions.map((session) => (
                <SessionCard
                    key={session.id}
                    session={session}
                    onView={handleView}
                />
            ))}
        </div>
    );
}

/**
 * Loading skeleton for recent batch scans
 */
function RecentBatchScansSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div 
                    key={i} 
                    className="rounded-2xl border border-neutral-800/50 bg-gradient-to-r from-neutral-900/80 to-neutral-900/40 p-4 sm:p-5"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <Skeleton className="h-6 w-24 rounded-full bg-neutral-800/80" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-full sm:w-64 bg-neutral-800/60" />
                            <Skeleton className="h-3 w-48 bg-neutral-800/40" />
                        </div>
                        <Skeleton className="h-9 w-20 rounded-lg bg-neutral-800/60" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Recent batch scans section showing last 3 batch sessions
 */
function RecentBatchScans() {
    const navigate = useNavigate();
    const { data, isLoading } = useBatchScanHistory({ page: 1, limit: 3 });

    const handleView = (batchId: string) => {
        navigate({ to: '/batch/$batchId', params: { batchId } });
    };

    if (isLoading) {
        return <RecentBatchScansSkeleton />;
    }

    const sessions = data?.data ?? [];

    if (sessions.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-neutral-700/50 bg-neutral-900/20 p-8 sm:p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-neutral-700/50">
                        <svg className="h-8 w-8 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className="space-y-1">
                        <p className="text-base font-medium text-neutral-300">
                            No batch scans yet
                        </p>
                        <p className="text-sm text-neutral-500">
                            Use a sitemap to scan your entire website at once!
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {sessions.map((session) => (
                <BatchSessionCard
                    key={session.id}
                    session={session}
                    onView={handleView}
                />
            ))}
        </div>
    );
}

/**
 * Loading screen shown when starting a pending scan after login
 */
function StartingScanLoader({ url }: { url: string }) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center space-y-6 max-w-md mx-auto px-4">
                {/* Animated scanner icon */}
                <div className="relative mx-auto w-20 h-20">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 animate-pulse" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    {/* Scanning animation ring */}
                    <div className="absolute -inset-2 rounded-3xl border-2 border-primary-500/30 animate-ping" style={{ animationDuration: '2s' }} />
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Starting Your Scan</h2>
                    <p className="text-neutral-400">
                        Analyzing accessibility for
                    </p>
                    <p className="text-primary-400 font-medium truncate">
                        {url}
                    </p>
                </div>
                
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        </div>
    );
}

/**
 * Home page with scan form and recent scans
 * Requirements: 1.1, 1.4
 */
export function HomePage() {
    const startScan = useStartScan();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const search = useSearch({ strict: false }) as { startScan?: string };
    const hasProcessedPendingScan = useRef(false);
    const [pendingScanUrl, setPendingScanUrl] = useState<string | null>(null);

    // Check if we have a pending scan to process
    const hasPendingScan = search?.startScan === 'true' && sessionStorage.getItem('pendingScan');
    const isProcessingPendingScan = hasPendingScan || pendingScanUrl !== null || startScan.isPending;

    // Check for pending scan after login - only run once when authenticated
    useEffect(() => {
        // Don't process if auth is still loading
        if (isAuthLoading) return;
        
        // Don't process if not authenticated
        if (!isAuthenticated) return;
        
        // Don't process if we've already handled this
        if (hasProcessedPendingScan.current) return;
        
        // Only process if we have the startScan flag
        if (search?.startScan !== 'true') return;

        const pendingScanData = sessionStorage.getItem('pendingScan');
        if (pendingScanData) {
            hasProcessedPendingScan.current = true;
            try {
                const { url, viewport } = JSON.parse(pendingScanData);
                // Set the URL for the loading screen
                setPendingScanUrl(url);
                // Clear the pending scan from storage
                sessionStorage.removeItem('pendingScan');
                // Start the scan - this will navigate to scan page on success
                startScan.mutate({ url, viewport });
            } catch {
                // Invalid data, just clear it
                sessionStorage.removeItem('pendingScan');
                setPendingScanUrl(null);
            }
        }
    }, [isAuthenticated, isAuthLoading, search?.startScan, startScan]);

    const handleSubmit = (url: string, viewport: Viewport) => {
        startScan.mutate({ url, viewport });
    };

    // Show loading screen when processing a pending scan after login
    if (pendingScanUrl && isProcessingPendingScan) {
        return (
            <div className="relative">
                <GradientOrb className="h-96 w-96 bg-primary-500 -top-48 -left-48" />
                <GradientOrb className="h-72 w-72 bg-cyan-500 top-1/3 -right-36" />
                <StartingScanLoader url={pendingScanUrl} />
            </div>
        );
    }

    return (
        <div className="relative space-y-12 lg:space-y-16">
            {/* Background gradient orbs */}
            <GradientOrb className="h-96 w-96 bg-primary-500 -top-48 -left-48" />
            <GradientOrb className="h-72 w-72 bg-cyan-500 top-1/3 -right-36" />
            <GradientOrb className="h-64 w-64 bg-violet-500 bottom-0 left-1/4" />

            {/* Hero section with gradient text */}
            <div className="relative text-center space-y-6 pt-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-sm font-medium mb-4">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                    </span>
                    AI-Powered Accessibility
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                        Audit Accessibility
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-primary-400 via-cyan-400 to-primary-400 bg-clip-text text-transparent">
                        Automatically
                    </span>
                </h1>
                <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                    Scan, detect, and auto-fix WCAG 2.2 AA violations using intelligent AI agents
                </p>
            </div>

            {/* Scan form card - glass morphism */}
            <div className="relative mx-auto max-w-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 via-cyan-500/10 to-violet-500/10 rounded-3xl blur-xl" />
                <div className="relative rounded-3xl border border-neutral-700/50 bg-neutral-900/70 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden">
                    {/* Header with glow effect */}
                    <div className="relative px-6 py-5 sm:px-8 sm:py-6 border-b border-neutral-700/50">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 to-transparent" />
                        <div className="relative flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">Start New Scan</h2>
                                <p className="text-sm text-neutral-400">Enter a URL to analyze for accessibility issues</p>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-6 sm:px-8 sm:py-8">
                        <ScanForm
                            onSubmit={handleSubmit}
                            isLoading={startScan.isPending}
                            error={startScan.error?.message}
                            disabled={startScan.isPending}
                        />
                    </div>
                </div>
            </div>

            {/* Batch scan promotion card */}
            <div className="relative mx-auto max-w-2xl">
                <a
                    href="/batch"
                    className="group block rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 to-transparent p-6 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 text-cyan-400 group-hover:from-cyan-500/30 group-hover:to-cyan-600/30 transition-all">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white group-hover:text-cyan-100 transition-colors">
                                Scan Your Entire Website
                            </h3>
                            <p className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">
                                Use your sitemap to scan all pages at once
                            </p>
                        </div>
                        <svg className="h-5 w-5 text-neutral-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </a>
            </div>

            {/* Recent scans - only show when authenticated */}
            {isAuthenticated && (
                <div className="relative mx-auto max-w-4xl">
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-primary-500 to-cyan-500" />
                            <h2 className="text-2xl sm:text-3xl font-bold text-white">Recent Scans</h2>
                        </div>
                        <a
                            href="/history"
                            className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50 text-sm font-medium text-neutral-300 hover:text-white transition-all"
                        >
                            View all
                            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>
                    <RecentScans />
                </div>
            )}

            {/* Recent batch scans - only show when authenticated */}
            {isAuthenticated && (
                <div className="relative mx-auto max-w-4xl">
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-cyan-500 to-violet-500" />
                            <h2 className="text-2xl sm:text-3xl font-bold text-white">Recent Batch Scans</h2>
                        </div>
                        <a
                            href="/batch"
                            className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50 text-sm font-medium text-neutral-300 hover:text-white transition-all"
                        >
                            View all
                            <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>
                    <RecentBatchScans />
                </div>
            )}
        </div>
    );
}

export default HomePage;
