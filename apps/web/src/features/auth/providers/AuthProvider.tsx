/**
 * Authentication Provider Component
 * Provides auth context and factory for auth adapter based on config
 * Requirements: 7.1, 8.1
 */
import {
    createContext,
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import type { AuthAdapter, AuthConfig, AuthContextValue } from '../types';
import type { Credentials, User } from '@/types/domain';
import { CognitoAuthAdapter } from './CognitoAuthAdapter';
import { LocalAuthAdapter } from './LocalAuthAdapter';
import { env, shouldUseDevAutoLogin, getDevCredentials } from '@/config/env';

/**
 * Auth context for providing authentication state and methods
 */
export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Props for AuthProvider component
 */
export interface AuthProviderProps {
    children: ReactNode;
    config?: AuthConfig;
}

/**
 * Factory function to create the appropriate auth adapter based on config
 * Requirements: 7.1, 8.1
 */
function createAuthAdapter(config: AuthConfig): AuthAdapter {
    if (config.mode === 'saas') {
        if (!config.cognito) {
            throw new Error('Cognito configuration is required for SaaS mode');
        }
        return new CognitoAuthAdapter(config.cognito);
    }
    
    // Self-hosted mode uses local JWT authentication
    const endpoint = config.localEndpoint || env.apiUrl;
    return new LocalAuthAdapter(endpoint);
}

/**
 * Get default auth config from environment
 */
function getDefaultAuthConfig(): AuthConfig {
    return {
        mode: env.authMode,
        localEndpoint: env.apiUrl,
        // Cognito config from environment
        cognito: env.authMode === 'saas' ? {
            userPoolId: env.cognito.userPoolId,
            clientId: env.cognito.clientId,
            region: env.cognito.region,
            domain: env.cognito.domain,
        } : undefined,
    };
}

/**
 * AuthProvider component
 * Wraps the application with authentication context
 * Requirements: 7.1, 8.1
 */
export function AuthProvider({ children, config }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create auth adapter based on config - memoize with stable dependencies
    const adapter = useMemo(() => {
        const authConfig = config || getDefaultAuthConfig();
        return createAuthAdapter(authConfig);
    }, [config]);

    // Check for existing session on mount, with dev auto-login support
    useEffect(() => {
        let mounted = true;

        async function checkAuthAndAutoLogin() {
            try {
                const existingUser = await adapter.getUser();
                if (mounted && existingUser) {
                    setUser(existingUser);
                    setIsLoading(false);
                    return;
                }

                // Auto-login with dev credentials if enabled and no session
                if (mounted && shouldUseDevAutoLogin()) {
                    const devCredentials = getDevCredentials();
                    console.log('[Dev] Auto-login enabled, logging in as:', devCredentials.email);
                    const autoLoginUser = await adapter.login(devCredentials);
                    if (mounted) {
                        setUser(autoLoginUser);
                    }
                }
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to restore session');
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        }

        checkAuthAndAutoLogin();

        return () => {
            mounted = false;
        };
    }, [adapter]);

    /**
     * Login with email/password credentials
     * Requirements: 7.2
     */
    const login = useCallback(async (credentials: Credentials) => {
        setIsLoading(true);
        setError(null);
        
        try {
            const loggedInUser = await adapter.login(credentials);
            setUser(loggedInUser);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [adapter]);

    /**
     * Login with SSO provider (Google or GitHub)
     * Requirements: 7.2
     */
    const loginWithSSO = useCallback(async (provider: 'google' | 'github') => {
        setIsLoading(true);
        setError(null);
        
        try {
            const loggedInUser = await adapter.loginWithSSO(provider);
            setUser(loggedInUser);
        } catch (err) {
            const message = err instanceof Error ? err.message : `SSO login with ${provider} failed`;
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [adapter]);

    /**
     * Logout the current user
     * Requirements: 7.5
     */
    const logout = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        try {
            await adapter.logout();
            setUser(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Logout failed';
            setError(message);
            // Still clear user on logout error
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, [adapter]);

    /**
     * Get the current auth token for API requests
     */
    const getToken = useCallback(async () => {
        return adapter.getToken();
    }, [adapter]);

    // Memoize context value to prevent unnecessary re-renders
    const contextValue = useMemo<AuthContextValue>(() => ({
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        loginWithSSO,
        logout,
        getToken,
    }), [user, isLoading, login, loginWithSSO, logout, getToken]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Export the adapter factory for testing purposes
 */
export { createAuthAdapter };
