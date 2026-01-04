/**
 * Login page component
 * LoginForm and SSOButtons integration with redirect after login
 * Requirements: 7.2
 */
import { useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { SSOButtons, type SSOProvider } from '@/features/auth/components/SSOButtons';
import { ModeIndicator } from '@/features/auth/components/ModeIndicator';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isSaasMode } from '@/config/env';

/**
 * Divider with text
 */
function Divider({ text }: { text: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-neutral-700" />
      </div>
      <div className="relative flex justify-center text-sm">
        <span className="bg-neutral-900 px-4 text-neutral-400">{text}</span>
      </div>
    </div>
  );
}

/**
 * Login page with form and SSO options
 * Requirements: 7.2
 */
export function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/login' });
  const { login, loginWithSSO, isAuthenticated, isLoading } = useAuth();

  // Redirect to saved URL if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = (search as { redirect?: string })?.redirect ?? '/';

      // Parse the redirect URL to extract path and search params
      try {
        // Handle relative URLs like "/?startScan=true"
        const url = new URL(redirectTo, window.location.origin);
        const searchParams: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          searchParams[key] = value;
        });

        navigate({
          to: url.pathname,
          search: Object.keys(searchParams).length > 0 ? searchParams : undefined,
        });
      } catch {
        // Fallback to simple navigation
        navigate({ to: redirectTo });
      }
    }
  }, [isAuthenticated, navigate, search]);

  const handleLogin = async (credentials: { email: string; password: string }) => {
    await login(credentials);
    // Navigation happens in useEffect when isAuthenticated changes
  };

  const handleSSOLogin = async (provider: SSOProvider) => {
    await loginWithSSO(provider);
    // Navigation happens in useEffect when isAuthenticated changes
  };

  // Don't render login form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  const showSSO = isSaasMode();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">Welcome to AccessAudit</h1>
          <p className="mt-2 text-neutral-400">Sign in to access your accessibility dashboard</p>
        </div>

        {/* Login card - dark themed */}
        <div className="rounded-2xl border border-neutral-700/50 bg-neutral-900/70 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden">
          {/* Header */}
          <div className="border-b border-neutral-700/50 px-6 py-4">
            <h2 className="text-lg font-semibold text-white text-center">Sign In</h2>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* SSO buttons (only in SaaS mode) */}
            {showSSO && (
              <>
                <SSOButtons onSSOLogin={handleSSOLogin} isLoading={isLoading} />
                <Divider text="or continue with email" />
              </>
            )}

            {/* Email/password form */}
            <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
          </div>
        </div>

        {/* Mode indicator */}
        <div className="mt-6 flex justify-center">
          <ModeIndicator />
        </div>

        {/* Help text */}
        <p className="mt-6 text-center text-sm text-neutral-500">
          By signing in, you agree to our{' '}
          <a href="#" className="text-primary-400 hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-primary-400 hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
