/**
 * LoginForm Component
 * Email/password login form with Zod validation
 * Requirements: 7.2
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import type { Credentials } from '@/types/domain';

/**
 * Login form validation schema
 */
const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Props for LoginForm component
 */
export interface LoginFormProps {
  /** Callback when form is submitted with valid credentials */
  onSubmit: (credentials: Credentials) => Promise<void>;
  /** Whether the form is in a loading state */
  isLoading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Optional class name for styling */
  className?: string;
}

/**
 * LoginForm component
 * Provides email/password inputs with validation
 * Requirements: 7.2
 */
export function LoginForm({ onSubmit, isLoading = false, error, className = '' }: LoginFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleFormSubmit = async (data: LoginFormData) => {
    setSubmitError(null);
    try {
      await onSubmit(data);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    }
  };

  const displayError = error || submitError;
  const isFormLoading = isLoading || isSubmitting;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className={`space-y-4 ${className}`} noValidate>
      {displayError && (
        <div
          className="rounded-md bg-error-50 p-4 text-sm text-error-700"
          role="alert"
          aria-live="polite"
        >
          {displayError}
        </div>
      )}

      <Input
        {...register('email')}
        type="email"
        label="Email"
        placeholder="you@example.com"
        autoComplete="email"
        disabled={isFormLoading}
        errorMessage={errors.email?.message}
        aria-required="true"
      />

      <Input
        {...register('password')}
        type="password"
        label="Password"
        placeholder="Enter your password"
        autoComplete="current-password"
        disabled={isFormLoading}
        errorMessage={errors.password?.message}
        aria-required="true"
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isFormLoading}
        disabled={isFormLoading}
        className="w-full"
      >
        {isFormLoading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
