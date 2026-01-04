/**
 * Auth feature types
 * Requirements: 7.1, 7.2, 8.1
 */
import type { AuthProviderType, Credentials, User } from '@/types/domain';

// Re-export domain types used in auth feature
export type { AuthProviderType, Credentials, User };

/**
 * Authentication adapter interface for different auth providers
 * Requirements: 7.1, 8.1
 */
export interface AuthAdapter {
    getUser(): Promise<User | null>;
    login(credentials: Credentials): Promise<User>;
    loginWithSSO(provider: 'google' | 'github'): Promise<User>;
    logout(): Promise<void>;
    getToken(): Promise<string | null>;
}

/**
 * Authentication context value provided to components
 */
export interface AuthContextValue {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (credentials: Credentials) => Promise<void>;
    loginWithSSO: (provider: 'google' | 'github') => Promise<void>;
    logout: () => Promise<void>;
    /** Get the current auth token for API requests */
    getToken: () => Promise<string | null>;
}

/**
 * Configuration for authentication
 */
export interface AuthConfig {
    mode: 'saas' | 'self-hosted';
    cognito?: {
        userPoolId: string;
        clientId: string;
        region: string;
        domain?: string;
    };
    localEndpoint?: string;
}
