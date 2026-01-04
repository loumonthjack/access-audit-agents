/**
 * Batch scan initiation page
 * Allows users to enter a sitemap URL and start a batch scan
 * Requirements: 6.1, 8.1
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { URLPreviewList } from '@/features/batch-scan/components/URLPreviewList';
import { useParseSitemap, useCreateBatchScan } from '@/features/batch-scan/api/batchApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select, type SelectOption } from '@/shared/components/ui/Select';
import type { ParsedUrl, Viewport } from '@/types/domain';

/**
 * Schema for sitemap form validation
 */
const SitemapFormSchema = z.object({
    sitemapUrl: z
        .string()
        .min(1, 'Sitemap URL is required')
        .url('Please enter a valid URL')
        .refine(
            (url) => url.startsWith('http://') || url.startsWith('https://'),
            'URL must start with http:// or https://'
        )
        .refine(
            (url) => url.endsWith('.xml') || url.includes('/sitemap'),
            'URL should be a sitemap (ending in .xml or containing /sitemap)'
        ),
    maxUrls: z.number().min(1, 'Must be at least 1').max(50000, 'Maximum is 50,000 URLs'),
});

type SitemapFormInput = z.infer<typeof SitemapFormSchema>;

/**
 * Options for max URLs selector
 */
const maxUrlsOptions: SelectOption<number>[] = [
    { value: 100, label: '100 URLs' },
    { value: 500, label: '500 URLs' },
    { value: 1000, label: '1,000 URLs' },
    { value: 5000, label: '5,000 URLs' },
    { value: 10000, label: '10,000 URLs' },
    { value: 50000, label: '50,000 URLs (max)' },
];

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
 * Batch scan initiation page
 * Requirements: 6.1, 8.1
 */
export function BatchPage() {
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as { startScan?: string };
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const hasProcessedPendingScan = useRef(false);

    // State for the multi-step flow
    const [parsedUrls, setParsedUrls] = useState<ParsedUrl[]>([]);
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
    const [showPreview, setShowPreview] = useState(false);
    const [sitemapUrl, setSitemapUrl] = useState('');

    // Form setup
    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors, isValid },
    } = useForm<SitemapFormInput>({
        resolver: zodResolver(SitemapFormSchema),
        defaultValues: {
            sitemapUrl: '',
            maxUrls: 1000,
        },
        mode: 'onChange',
    });

    const sitemapUrlValue = watch('sitemapUrl');

    // API hooks
    const parseSitemap = useParseSitemap();
    const createBatchScan = useCreateBatchScan();

    // Check for pending batch scan after login
    useEffect(() => {
        if (isAuthLoading) return;
        if (!isAuthenticated) return;
        if (hasProcessedPendingScan.current) return;
        if (search?.startScan !== 'true') return;

        const pendingData = sessionStorage.getItem('pendingBatchScan');
        if (pendingData) {
            hasProcessedPendingScan.current = true;
            try {
                const request = JSON.parse(pendingData);
                sessionStorage.removeItem('pendingBatchScan');
                createBatchScan.mutate(request);
            } catch {
                sessionStorage.removeItem('pendingBatchScan');
            }
        }
    }, [isAuthenticated, isAuthLoading, search?.startScan, createBatchScan]);

    // Handle sitemap form submission
    const handleParseSitemap = async (data: SitemapFormInput) => {
        setSitemapUrl(data.sitemapUrl);
        
        try {
            const result = await parseSitemap.mutateAsync({
                sitemapUrl: data.sitemapUrl,
                maxUrls: data.maxUrls,
            });
            
            setParsedUrls(result.urls);
            setSelectedUrls(new Set(result.urls.map(u => u.loc)));
            setShowPreview(true);
        } catch {
            // Error is handled by the mutation
        }
    };

    // Handle batch scan creation
    const handleConfirmUrls = () => {
        const urls = Array.from(selectedUrls);
        createBatchScan.mutate({
            urls,
            viewport: 'desktop' as Viewport,
            name: `Batch scan from ${new URL(sitemapUrl).hostname}`,
        });
    };

    // Handle cancel/back
    const handleCancel = () => {
        setShowPreview(false);
        setParsedUrls([]);
        setSelectedUrls(new Set());
    };

    const isLoading = parseSitemap.isPending;
    const showSuccessIcon = isValid && sitemapUrlValue && !errors.sitemapUrl;

    return (
        <div className="relative space-y-12 lg:space-y-16">
            {/* Background gradient orbs */}
            <GradientOrb className="h-96 w-96 bg-cyan-500 -top-48 -left-48" />
            <GradientOrb className="h-72 w-72 bg-violet-500 top-1/3 -right-36" />
            <GradientOrb className="h-64 w-64 bg-primary-500 bottom-0 left-1/4" />

            {/* Hero section */}
            <div className="relative text-center space-y-6 pt-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium mb-4">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                    </span>
                    Batch Scanning
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                    <span className="bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent">
                        Scan Your
                    </span>
                    <br />
                    <span className="bg-gradient-to-r from-cyan-400 via-primary-400 to-cyan-400 bg-clip-text text-transparent">
                        Entire Website
                    </span>
                </h1>
                <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                    Provide your sitemap URL and we'll scan all pages for accessibility issues
                </p>
            </div>

            {/* Main content */}
            <div className="relative mx-auto max-w-4xl">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-primary-500/10 to-violet-500/10 rounded-3xl blur-xl" />
                <div className="relative rounded-3xl border border-neutral-700/50 bg-neutral-900/70 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden">
                    {/* Header */}
                    <div className="relative px-6 py-5 sm:px-8 sm:py-6 border-b border-neutral-700/50">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent" />
                        <div className="relative flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white">
                                    {showPreview ? 'Select URLs to Scan' : 'Enter Sitemap URL'}
                                </h2>
                                <p className="text-sm text-neutral-400">
                                    {showPreview
                                        ? `${parsedUrls.length} URLs discovered from sitemap`
                                        : 'We\'ll discover all pages from your sitemap'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-6 sm:px-8 sm:py-8">
                        {showPreview ? (
                            <URLPreviewList
                                urls={parsedUrls}
                                selectedUrls={selectedUrls}
                                onSelectionChange={setSelectedUrls}
                                onConfirm={handleConfirmUrls}
                                onCancel={handleCancel}
                                isLoading={createBatchScan.isPending}
                            />
                        ) : (
                            <form
                                onSubmit={handleSubmit(handleParseSitemap)}
                                className="space-y-4"
                                aria-label="Parse sitemap for batch scanning"
                            >
                                <Input
                                    {...register('sitemapUrl')}
                                    label="Sitemap URL"
                                    placeholder="https://example.com/sitemap.xml"
                                    type="url"
                                    errorMessage={errors.sitemapUrl?.message}
                                    disabled={isLoading}
                                    helperText="Enter the URL of your sitemap.xml file"
                                    rightIcon={
                                        showSuccessIcon ? (
                                            <svg
                                                className="h-5 w-5 text-success-500"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        ) : undefined
                                    }
                                />

                                <Controller
                                    name="maxUrls"
                                    control={control}
                                    render={({ field }) => (
                                        <Select
                                            label="Maximum URLs to Parse"
                                            value={field.value}
                                            onChange={field.onChange}
                                            options={maxUrlsOptions}
                                            disabled={isLoading}
                                            errorMessage={errors.maxUrls?.message}
                                            helperText="Limit the number of URLs to discover from the sitemap"
                                        />
                                    )}
                                />

                                {parseSitemap.error && (
                                    <div
                                        role="alert"
                                        className="rounded-lg bg-error-50 border border-error-200 p-4 animate-shake"
                                    >
                                        <div className="flex items-start gap-3">
                                            <svg
                                                className="h-5 w-5 text-error-500 flex-shrink-0"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            <div>
                                                <p className="font-medium text-error-800">Error parsing sitemap</p>
                                                <p className="mt-1 text-sm text-error-700">{parseSitemap.error.message}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    isLoading={isLoading}
                                    disabled={isLoading || !isValid}
                                    className="w-full"
                                    size="lg"
                                    data-testid="parse-sitemap-button"
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="animate-pulse">Parsing Sitemap</span>
                                            <span className="animate-bounce">...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg
                                                className="h-5 w-5"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                />
                                            </svg>
                                            Parse Sitemap
                                        </>
                                    )}
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BatchPage;
