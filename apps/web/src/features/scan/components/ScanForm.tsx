/**
 * ScanForm component for initiating accessibility scans
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select, type SelectOption } from '@/shared/components/ui/Select';
import { ScanFormSchema, type ScanFormInput } from '@/types/schemas';
import type { Viewport } from '@/types/domain';

export interface ScanFormProps {
    /** Called when form is submitted with valid data */
    onSubmit: (url: string, viewport: Viewport) => void;
    /** Whether a scan is currently in progress */
    isLoading: boolean;
    /** Error message to display */
    error?: string;
    /** Whether the scan button should be disabled (e.g., active scan in progress) */
    disabled?: boolean;
}

const viewportOptions: SelectOption<Viewport>[] = [
    { value: 'desktop', label: 'Desktop' },
    { value: 'mobile', label: 'Mobile' },
];

/**
 * Form for entering URL and viewport to start an accessibility scan
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export function ScanForm({ onSubmit, isLoading, error, disabled }: ScanFormProps) {
    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors, isValid },
    } = useForm<ScanFormInput>({
        resolver: zodResolver(ScanFormSchema),
        defaultValues: {
            url: '',
            viewport: 'desktop',
        },
        mode: 'onChange', // Enable real-time validation
    });

    const urlValue = watch('url');
    const handleFormSubmit = (data: ScanFormInput) => {
        onSubmit(data.url, data.viewport);
    };

    const isDisabled = disabled || isLoading;
    const showSuccessIcon = isValid && urlValue && !errors.url;

    return (
        <form
            onSubmit={handleSubmit(handleFormSubmit)}
            className="space-y-4"
            aria-label="Start accessibility scan"
        >
            <Input
                {...register('url')}
                label="Website URL"
                placeholder="https://example.com"
                type="url"
                errorMessage={errors.url?.message}
                disabled={isDisabled}
                aria-describedby={error ? 'scan-error' : undefined}
                rightIcon={
                    showSuccessIcon ? (
                        <svg className="h-5 w-5 text-success-500" fill="currentColor" viewBox="0 0 20 20">
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
                name="viewport"
                control={control}
                render={({ field }) => (
                    <Select
                        label="Viewport"
                        value={field.value}
                        onChange={field.onChange}
                        options={viewportOptions}
                        disabled={isDisabled}
                        errorMessage={errors.viewport?.message}
                    />
                )}
            />

            {error && (
                <div
                    id="scan-error"
                    role="alert"
                    className="rounded-lg bg-error-50 border border-error-200 p-4 animate-shake"
                >
                    <div className="flex items-start gap-3">
                        <svg className="h-5 w-5 text-error-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <div>
                            <p className="font-medium text-error-800">Error starting scan</p>
                            <p className="mt-1 text-sm">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            <Button
                type="submit"
                isLoading={isLoading}
                disabled={isDisabled}
                className="w-full"
                size="lg"
                data-testid="scan-submit-button"
            >
                {isLoading ? (
                    <>
                        <span className="animate-pulse">Scanning</span>
                        <span className="animate-bounce">...</span>
                    </>
                ) : (
                    <>
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        Start Scan
                    </>
                )}
            </Button>
        </form>
    );
}
