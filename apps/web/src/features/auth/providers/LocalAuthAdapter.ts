/**
 * Local Authentication Adapter
 * Simple JWT-based authentication for self-hosted deployments
 * Requirements: 8.1, 8.2, 8.3
 */
import type { AuthAdapter, AuthConfig } from '../types';
import type { Credentials, User } from '@/types/domain';

/**
 * Local auth configuration
 */
export interface LocalAuthConfig {
  endpoint: string;
}

/**
 * JWT token payload structure
 */
interface JWTPayload {
  sub: string;
  email: string;
  name?: string;
  exp: number;
  iat: number;
}

/**
 * LocalAuthAdapter implements AuthAdapter for self-hosted JWT authentication
 * Provides simple password-based auth without external providers
 * Requirements: 8.1, 8.2, 8.3
 */
export class LocalAuthAdapter implements AuthAdapter {
  private endpoint: string;
  private currentUser: User | null = null;
  private accessToken: string | null = null;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  /**
   * Get the currently authenticated user
   * Returns null if not authenticated
   */
  async getUser(): Promise<User | null> {
    try {
      // Check if we have a stored user
      if (this.currentUser) {
        return this.currentUser;
      }

      // Try to restore session from storage
      const storedToken = this.getStoredToken();
      if (storedToken) {
        // Validate token and get user info
        const user = await this.validateAndGetUser(storedToken);
        if (user) {
          this.currentUser = user;
          this.accessToken = storedToken;
          return user;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Login with email and password credentials
   * Requirements: 8.1, 8.2
   */
  async login(credentials: Credentials): Promise<User> {
    try {
      const response = await fetch(`${this.endpoint}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Invalid credentials');
      }

      const data = await response.json();

      // Parse JWT to get user info
      const user = this.parseTokenToUser(data.token);

      this.currentUser = user;
      this.accessToken = data.token;

      // Store token for session persistence
      this.storeToken(data.token);

      return user;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Authentication failed. Please check your credentials.');
    }
  }

  /**
   * SSO is not supported in self-hosted mode
   * Requirements: 8.1
   */
  async loginWithSSO(provider: 'google' | 'github'): Promise<User> {
    throw new Error(
      `SSO authentication with ${provider} is not available in self-hosted mode. ` +
        'Please use email and password to login.'
    );
  }

  /**
   * Logout the current user
   * Requirements: 8.3
   */
  async logout(): Promise<void> {
    try {
      // Optionally notify the server about logout
      if (this.accessToken) {
        await fetch(`${this.endpoint}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }).catch(() => {
          // Ignore logout API errors
        });
      }
    } finally {
      // Always clear local state
      this.currentUser = null;
      this.accessToken = null;
      this.clearStoredToken();
    }
  }

  /**
   * Get the current access token for API requests
   */
  async getToken(): Promise<string | null> {
    if (this.accessToken) {
      // Check if token is expired
      if (this.isTokenExpired(this.accessToken)) {
        // Try to refresh the token
        const refreshed = await this.refreshToken();
        if (!refreshed) {
          this.currentUser = null;
          this.accessToken = null;
          this.clearStoredToken();
          return null;
        }
      }
      return this.accessToken;
    }

    // Try to restore from storage
    const storedToken = this.getStoredToken();
    if (storedToken && !this.isTokenExpired(storedToken)) {
      this.accessToken = storedToken;
      return storedToken;
    }

    return null;
  }

  /**
   * Parse JWT token to extract user information
   */
  private parseTokenToUser(token: string): User {
    try {
      const payload = this.decodeJWT(token);

      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        authProvider: 'local',
      };
    } catch {
      throw new Error('Invalid token format');
    }
  }

  /**
   * Decode JWT token payload (without verification - server handles that)
   */
  private decodeJWT(token: string): JWTPayload {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      throw new Error('Failed to decode JWT');
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeJWT(token);
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch {
      return true;
    }
  }

  /**
   * Validate stored token and get user info
   */
  private async validateAndGetUser(token: string): Promise<User | null> {
    try {
      // Check if token is expired
      if (this.isTokenExpired(token)) {
        return null;
      }

      // Optionally validate with server
      const response = await fetch(`${this.endpoint}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        authProvider: 'local',
      };
    } catch {
      // If server validation fails, try to parse token locally
      try {
        return this.parseTokenToUser(token);
      } catch {
        return null;
      }
    }
  }

  /**
   * Attempt to refresh the access token
   */
  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = this.getStoredRefreshToken();
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${this.endpoint}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      this.accessToken = data.token;
      this.storeToken(data.token);

      if (data.refreshToken) {
        this.storeRefreshToken(data.refreshToken);
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store token in localStorage for session persistence
   * Requirements: 8.3
   */
  private storeToken(token: string): void {
    try {
      localStorage.setItem('local_access_token', token);
    } catch {
      // localStorage might not be available
    }
  }

  /**
   * Get stored token from localStorage
   */
  private getStoredToken(): string | null {
    try {
      return localStorage.getItem('local_access_token');
    } catch {
      return null;
    }
  }

  /**
   * Clear stored token from localStorage
   */
  private clearStoredToken(): void {
    try {
      localStorage.removeItem('local_access_token');
      localStorage.removeItem('local_refresh_token');
    } catch {
      // localStorage might not be available
    }
  }

  /**
   * Store refresh token
   */
  private storeRefreshToken(token: string): void {
    try {
      localStorage.setItem('local_refresh_token', token);
    } catch {
      // localStorage might not be available
    }
  }

  /**
   * Get stored refresh token
   */
  private getStoredRefreshToken(): string | null {
    try {
      return localStorage.getItem('local_refresh_token');
    } catch {
      return null;
    }
  }
}

/**
 * Factory function to create LocalAuthAdapter from AuthConfig
 */
export function createLocalAuthAdapter(config: AuthConfig): LocalAuthAdapter {
  const endpoint = config.localEndpoint || '/api';
  return new LocalAuthAdapter(endpoint);
}
