/**
 * useAuth Hook
 * Provides access to authentication state and methods
 * Requirements: 7.1, 7.2, 7.5
 */
import { useContext } from 'react';
import { AuthContext } from '../providers/AuthProvider';
import type { AuthContextValue } from '../types';

/**
 * Hook to access authentication context
 * Must be used within an AuthProvider
 * Requirements: 7.1, 7.2, 7.5
 * 
 * @returns AuthContextValue with user, isAuthenticated, isLoading, and auth methods
 * @throws Error if used outside of AuthProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, login, logout } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <LoginForm onSubmit={login} />;
 *   }
 *   
 *   return (
 *     <div>
 *       <p>Welcome, {user?.email}</p>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error(
            'useAuth must be used within an AuthProvider. ' +
            'Make sure your component is wrapped with <AuthProvider>.'
        );
    }

    return context;
}

/**
 * Hook to check if user is authenticated
 * Convenience wrapper around useAuth
 * 
 * @returns boolean indicating if user is authenticated
 */
export function useIsAuthenticated(): boolean {
    const { isAuthenticated } = useAuth();
    return isAuthenticated;
}

/**
 * Hook to get current user
 * Convenience wrapper around useAuth
 * 
 * @returns User object or null if not authenticated
 */
export function useCurrentUser() {
    const { user } = useAuth();
    return user;
}

/**
 * Hook to check if auth is loading
 * Useful for showing loading states during auth checks
 * 
 * @returns boolean indicating if auth state is being determined
 */
export function useAuthLoading(): boolean {
    const { isLoading } = useAuth();
    return isLoading;
}
