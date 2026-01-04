/**
 * Auth + Routes Integration Tests
 * Tests protected route redirect and auth state persistence
 * Requirements: 7.1, 7.3
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useState } from 'react';
import { AuthContext } from '@/features/auth/providers/AuthProvider';
import { ProtectedRoute, useRequiresAuth } from '@/shared/components/auth/ProtectedRoute';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { AuthContextValue } from '@/features/auth/types';
import type { User } from '@/types/domain';
import { createTestQueryClient, mockUser, createMockAuthContext, createAuthenticatedContext } from '../utils';

// Mock the env module to control SaaS mode
vi.mock('@/config/env', () => ({
    env: {
        apiUrl: 'http://localhost:3000/api',
        wsUrl: 'ws://localhost:3000/ws',
        authMode: 'saas',
        isDev: true,
        isProd: false,
    },
    isSaasMode: vi.fn(() => true),
    isSelfHostedMode: vi.fn(() => false),
}));

// Mock TanStack Router hooks
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/dashboard' };

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
}));

describe('Auth + Routes Integration Tests', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = createTestQueryClient();
        vi.clearAllMocks();
    });

    afterEach(() => {
        queryClient.clear();
    });

    describe('Protected Route Redirect', () => {
        it('should redirect to login when not authenticated in SaaS mode', async () => {
            const unauthenticatedContext = createMockAuthContext({
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });

            render(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={unauthenticatedContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith({
                    to: '/login',
                    search: { redirect: '/dashboard' },
                });
            });
        });

        it('should render protected content when authenticated', async () => {
            const authenticatedContext = createAuthenticatedContext(mockUser);

            render(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={authenticatedContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            expect(screen.getByText('Protected Content')).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('should show loading state while checking auth', () => {
            const loadingContext = createMockAuthContext({
                user: null,
                isAuthenticated: false,
                isLoading: true,
            });

            render(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={loadingContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            // Should show loading, not protected content
            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
            expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
        });

        it('should not render protected content when not authenticated', () => {
            const unauthenticatedContext = createMockAuthContext({
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });

            render(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={unauthenticatedContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
        });

        it('should redirect to custom path when specified', async () => {
            const unauthenticatedContext = createMockAuthContext({
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });

            render(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={unauthenticatedContext}>
                        <ProtectedRoute redirectTo="/custom-login">
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith({
                    to: '/custom-login',
                    search: { redirect: '/dashboard' },
                });
            });
        });
    });

    describe('Auth State Persistence', () => {
        it('should maintain auth state across component re-renders', async () => {
            const authenticatedContext = createAuthenticatedContext(mockUser);

            const { rerender } = render(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={authenticatedContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            expect(screen.getByText('Protected Content')).toBeInTheDocument();

            // Re-render with same context
            rerender(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={authenticatedContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            // Should still show protected content
            expect(screen.getByText('Protected Content')).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('should redirect when auth state changes to unauthenticated', async () => {
            // Start authenticated
            const authenticatedContext = createAuthenticatedContext(mockUser);

            const { rerender } = render(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={authenticatedContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            expect(screen.getByText('Protected Content')).toBeInTheDocument();

            // Change to unauthenticated
            const unauthenticatedContext = createMockAuthContext({
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });

            rerender(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={unauthenticatedContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith({
                    to: '/login',
                    search: { redirect: '/dashboard' },
                });
            });
        });

        it('should show content when auth state changes to authenticated', async () => {
            // Start loading
            const loadingContext = createMockAuthContext({
                user: null,
                isAuthenticated: false,
                isLoading: true,
            });

            const { rerender } = render(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={loadingContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

            // Change to authenticated
            const authenticatedContext = createAuthenticatedContext(mockUser);

            rerender(
                <QueryClientProvider client={queryClient}>
                    <AuthContext.Provider value={authenticatedContext}>
                        <ProtectedRoute>
                            <div>Protected Content</div>
                        </ProtectedRoute>
                    </AuthContext.Provider>
                </QueryClientProvider>
            );

            expect(screen.getByText('Protected Content')).toBeInTheDocument();
        });
    });

    describe('useAuth Hook', () => {
        it('should provide auth context values', () => {
            const authenticatedContext = createAuthenticatedContext(mockUser);
            let authValue: AuthContextValue | null = null;

            function TestComponent() {
                authValue = useAuth();
                return <div>Test</div>;
            }

            render(
                <AuthContext.Provider value={authenticatedContext}>
                    <TestComponent />
                </AuthContext.Provider>
            );

            expect(authValue).not.toBeNull();
            expect(authValue!.user).toEqual(mockUser);
            expect(authValue!.isAuthenticated).toBe(true);
            expect(authValue!.isLoading).toBe(false);
        });

        it('should throw error when used outside AuthProvider', () => {
            function TestComponent() {
                useAuth();
                return <div>Test</div>;
            }

            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => {
                render(<TestComponent />);
            }).toThrow('useAuth must be used within an AuthProvider');

            consoleSpy.mockRestore();
        });
    });

    describe('Auth Methods', () => {
        it('should call login method with credentials', async () => {
            const loginMock = vi.fn();
            const authContext = createMockAuthContext({
                login: loginMock,
            });

            function TestComponent() {
                const { login } = useAuth();
                return (
                    <button onClick={() => login({ email: 'test@example.com', password: 'password' })}>
                        Login
                    </button>
                );
            }

            render(
                <AuthContext.Provider value={authContext}>
                    <TestComponent />
                </AuthContext.Provider>
            );

            await userEvent.click(screen.getByText('Login'));

            expect(loginMock).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password',
            });
        });

        it('should call logout method', async () => {
            const logoutMock = vi.fn();
            const authContext = createAuthenticatedContext(mockUser);
            authContext.logout = logoutMock;

            function TestComponent() {
                const { logout } = useAuth();
                return <button onClick={logout}>Logout</button>;
            }

            render(
                <AuthContext.Provider value={authContext}>
                    <TestComponent />
                </AuthContext.Provider>
            );

            await userEvent.click(screen.getByText('Logout'));

            expect(logoutMock).toHaveBeenCalled();
        });

        it('should call loginWithSSO method', async () => {
            const loginWithSSOMock = vi.fn();
            const authContext = createMockAuthContext({
                loginWithSSO: loginWithSSOMock,
            });

            function TestComponent() {
                const { loginWithSSO } = useAuth();
                return (
                    <button onClick={() => loginWithSSO('google')}>
                        Login with Google
                    </button>
                );
            }

            render(
                <AuthContext.Provider value={authContext}>
                    <TestComponent />
                </AuthContext.Provider>
            );

            await userEvent.click(screen.getByText('Login with Google'));

            expect(loginWithSSOMock).toHaveBeenCalledWith('google');
        });
    });

    describe('useRequiresAuth Hook', () => {
        it('should return true in SaaS mode', () => {
            let requiresAuth: boolean | undefined;

            function TestComponent() {
                requiresAuth = useRequiresAuth();
                return <div>Test</div>;
            }

            render(
                <AuthContext.Provider value={createMockAuthContext()}>
                    <TestComponent />
                </AuthContext.Provider>
            );

            expect(requiresAuth).toBe(true);
        });

        it('should return true when requireAuthInSelfHosted is true', () => {
            let requiresAuth: boolean | undefined;

            function TestComponent() {
                requiresAuth = useRequiresAuth(true);
                return <div>Test</div>;
            }

            render(
                <AuthContext.Provider value={createMockAuthContext()}>
                    <TestComponent />
                </AuthContext.Provider>
            );

            expect(requiresAuth).toBe(true);
        });
    });
});
