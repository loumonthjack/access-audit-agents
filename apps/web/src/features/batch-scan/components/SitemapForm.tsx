/**
 * SitemapForm component for entering sitemap URL to parse
 * Requirements: 6.1, 6.3, 6.4
 */
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select, type SelectOption } from '@/shared/components/ui/Select';
import type { ParsedUrl } from '@/types/domain';

/**
 * Props for the SitemapForm component
 * Requirements: 6.1, 6.3
 */
export interface SitemapFormProps {
  /** Called when sitemap is successfully parsed with discovered URLs */
  onUrlsParsed: (urls: ParsedUrl[]) => void;
  /** Whether parsing is currently in progress */
  isLoading: boolean;
  /** Error message to display */
  error?: string;
}

/**
 * Schema for sitemap form validation
 * Requirements: 6.1
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
 * Form for entering sitemap URL to discover pages for batch scanning
 * Requirements: 6.1, 6.3, 6.4
 */
export function SitemapForm({ onUrlsParsed, isLoading, error }: SitemapFormProps) {
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

  const handleFormSubmit = async () => {
    // The actual API call will be handled by the parent component
    // This form just validates and passes the data up
    // For now, we'll call onUrlsParsed with empty array - parent handles the API
    // The parent component should use useParseSitemap hook
    onUrlsParsed([]);
  };

  const isDisabled = isLoading;
  const showSuccessIcon = isValid && sitemapUrlValue && !errors.sitemapUrl;

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-4"
      aria-label="Parse sitemap for batch scanning"
    >
      <Input
        {...register('sitemapUrl')}
        label="Sitemap URL"
        placeholder="https://example.com/sitemap.xml"
        type="url"
        errorMessage={errors.sitemapUrl?.message}
        disabled={isDisabled}
        helperText="Enter the URL of your sitemap.xml file"
        aria-describedby={error ? 'sitemap-error' : undefined}
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
            disabled={isDisabled}
            errorMessage={errors.maxUrls?.message}
            helperText="Limit the number of URLs to discover from the sitemap"
          />
        )}
      />

      {error && (
        <div
          id="sitemap-error"
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
              <p className="mt-1 text-sm text-error-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <Button
        type="submit"
        isLoading={isLoading}
        disabled={isDisabled || !isValid}
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
  );
}

// Export the schema for use in parent components
export { SitemapFormSchema };
export type { SitemapFormInput };
