/**
 * Cognito Authentication Adapter
 * AWS Amplify Auth integration with SSO support (Google, GitHub)
 * Requirements: 2.4, 2.5, 2.6, 2.7, 7.1, 7.2
 */
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  signInWithRedirect,
} from 'aws-amplify/auth';
import type { AuthAdapter, AuthConfig } from '../types';
import type { Credentials, User, AuthProviderType } from '@/types/domain';

/**
 * Cognito configuration for AWS Amplify
 */
export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
  domain?: string;
}

/**
 * CognitoAuthAdapter implements AuthAdapter for AWS Cognito authentication
 * Supports email/password login and SSO via Google and GitHub
 * Requirements: 2.4, 2.5, 2.6, 2.7, 7.1, 7.2
 */
export class CognitoAuthAdapter implements AuthAdapter {
  private config: CognitoConfig;
  private cachedUser: User | null = null;

  constructor(config: CognitoConfig) {
    this.config = config;
  }

  /**
   * Get the currently authenticated user
   * Uses getCurrentUser and fetchAuthSession from aws-amplify/auth
   * Returns null if not authenticated
   * Requirements: 2.4
   */
  async getUser(): Promise<User | null> {
    try {
      // Get current authenticated user from Amplify
      const cognitoUser = await getCurrentUser();

      // Fetch the auth session to get user attributes
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;

      if (!idToken) {
        return null;
      }

      // Extract user info from ID token payload
      const payload = idToken.payload;

      const user: User = {
        id: cognitoUser.userId,
        email: (payload.email as string) || cognitoUser.username,
        name: (payload.name as string) || (payload.email as string)?.split('@')[0],
        authProvider: this.determineAuthProvider(payload),
      };

      this.cachedUser = user;
      return user;
    } catch {
      // User is not authenticated
      this.cachedUser = null;
      return null;
    }
  }

  /**
   * Login with email and password credentials
   * Uses signIn from aws-amplify/auth
   * Requirements: 2.4, 7.2
   */
  async login(credentials: Credentials): Promise<User> {
    try {
      // Sign in with Amplify
      const { isSignedIn, nextStep } = await signIn({
        username: credentials.email,
        password: credentials.password,
      });

      if (!isSignedIn) {
        // Handle additional auth steps if needed
        if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          throw new Error('Please confirm your email address before signing in.');
        }
        if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
          throw new Error('Password change required. Please reset your password.');
        }
        throw new Error(`Additional authentication step required: ${nextStep.signInStep}`);
      }

      // Get user info after successful sign in
      const user = await this.getUser();
      if (!user) {
        throw new Error('Failed to retrieve user information after sign in.');
      }

      return user;
    } catch (error) {
      // Re-throw with user-friendly message
      if (error instanceof Error) {
        // Handle specific Amplify error types
        if (error.name === 'NotAuthorizedException') {
          throw new Error('Invalid email or password.');
        }
        if (error.name === 'UserNotFoundException') {
          throw new Error('No account found with this email address.');
        }
        if (error.name === 'UserNotConfirmedException') {
          throw new Error('Please confirm your email address before signing in.');
        }
        throw error;
      }
      throw new Error('Authentication failed. Please check your credentials.');
    }
  }

  /**
   * Login with SSO provider (Google or GitHub)
   * Uses signInWithRedirect from aws-amplify/auth
   * Requirements: 7.2
   */
  async loginWithSSO(provider: 'google' | 'github'): Promise<User> {
    try {
      // Map provider to Amplify provider name
      const amplifyProvider = provider === 'google' ? 'Google' : 'GitHub';

      // Initiate federated sign in - this will redirect the user
      await signInWithRedirect({
        provider: amplifyProvider as 'Google' | 'GitHub',
      });

      // This code won't execute immediately as the user is redirected
      // After redirect back, getUser() should be called to get the user
      const user = await this.getUser();
      if (!user) {
        throw new Error('Failed to retrieve user information after SSO sign in.');
      }

      return user;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : `SSO authentication with ${provider} failed.`
      );
    }
  }

  /**
   * Logout the current user
   * Uses signOut from aws-amplify/auth
   * Requirements: 2.7, 7.5
   */
  async logout(): Promise<void> {
    try {
      await signOut();
      this.cachedUser = null;
    } catch (error) {
      // Clear cached user even if remote logout fails
      this.cachedUser = null;
      throw error;
    }
  }

  /**
   * Get the current access token for API requests
   * Uses fetchAuthSession from aws-amplify/auth to get JWT
   * Requirements: 2.5, 2.6
   */
  async getToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();

      // Return the ID token for API authorization
      // The ID token contains user claims and is typically used for API Gateway authorization
      const idToken = session.tokens?.idToken?.toString();

      if (idToken) {
        return idToken;
      }

      // Fallback to access token if ID token is not available
      const accessToken = session.tokens?.accessToken?.toString();
      return accessToken || null;
    } catch {
      // Session expired or user not authenticated
      return null;
    }
  }

  /**
   * Determine the auth provider from token payload
   */
  private determineAuthProvider(payload: Record<string, unknown>): AuthProviderType {
    // Check for identity provider in token
    const identities = payload.identities as Array<{ providerName?: string }> | undefined;

    if (identities && identities.length > 0) {
      const providerName = identities[0].providerName?.toLowerCase();
      if (providerName === 'google') return 'google';
      if (providerName === 'github') return 'github';
    }

    // Default to cognito for email/password users
    return 'cognito';
  }
}

/**
 * Factory function to create CognitoAuthAdapter from AuthConfig
 */
export function createCognitoAuthAdapter(config: AuthConfig): CognitoAuthAdapter {
  if (!config.cognito) {
    throw new Error('Cognito configuration is required for SaaS mode');
  }

  return new CognitoAuthAdapter(config.cognito);
}
