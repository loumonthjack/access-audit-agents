// Environment configuration with typed environment variables

/**
 * Deployment environment
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Authentication mode for the application
 * - 'saas': Uses Cognito authentication with SSO support
 * - 'self-hosted': Uses simplified local JWT authentication
 */
export type AuthMode = 'saas' | 'self-hosted';

/**
 * Cognito configuration for AWS authentication
 */
export interface CognitoConfig {
  /** Cognito User Pool ID */
  userPoolId: string;
  /** Cognito App Client ID */
  clientId: string;
  /** AWS Region for Cognito */
  region: string;
  /** Cognito hosted UI domain (optional) */
  domain?: string;
}

/**
 * Dev credentials for auto-login in local development
 */
export interface DevCredentials {
  /** Dev user email */
  email: string;
  /** Dev user password */
  password: string;
}

/**
 * Typed environment configuration
 */
export interface EnvConfig {
  /** Current environment (development, staging, production) */
  environment: Environment;
  /** Base URL for REST API endpoints */
  apiUrl: string;
  /** WebSocket URL for real-time progress streaming */
  wsUrl: string;
  /** Authentication mode (saas or self-hosted) */
  authMode: AuthMode;
  /** Cognito configuration (only used in saas mode) */
  cognito: CognitoConfig;
  /** Whether the app is running in development mode */
  isDev: boolean;
  /** Whether the app is running in production mode */
  isProd: boolean;
  /** Whether MSW mocking is enabled */
  enableMsw: boolean;
  /** Whether dev auto-login is enabled (only in dev + self-hosted) */
  enableDevAutoLogin: boolean;
  /** Dev credentials for auto-login */
  devCredentials: DevCredentials;
}

/**
 * Get environment variable with fallback
 */
function getEnvVar(key: string, fallback: string): string {
  return import.meta.env[key] ?? fallback;
}

/**
 * Parse environment from NODE_ENV or Vite mode
 */
function parseEnvironment(): Environment {
  // Check Vite mode first (set during build)
  const mode = import.meta.env.MODE;
  if (mode === 'staging') return 'staging';
  if (mode === 'production') return 'production';

  // Check explicit NODE_ENV variable
  const nodeEnv = getEnvVar('VITE_NODE_ENV', '');
  if (nodeEnv === 'staging') return 'staging';
  if (nodeEnv === 'production') return 'production';

  // Default to development
  return 'development';
}

/**
 * Parse auth mode from environment variable
 */
function parseAuthMode(value: string): AuthMode {
  if (value === 'saas' || value === 'self-hosted') {
    return value;
  }
  // Default to self-hosted for easier local development
  return 'self-hosted';
}

/**
 * Get default API URL based on environment
 */
function getDefaultApiUrl(environment: Environment): string {
  switch (environment) {
    case 'development':
      return 'http://localhost:3001/api';
    case 'staging':
      return 'https://api.staging.accessagents.io/api';
    case 'production':
      return 'https://api.accessagents.io/api';
  }
}

/**
 * Get default WebSocket URL based on environment
 */
function getDefaultWsUrl(environment: Environment): string {
  switch (environment) {
    case 'development':
      return 'ws://localhost:3001/ws';
    case 'staging':
      return 'wss://ws.staging.accessagents.io';
    case 'production':
      return 'wss://ws.accessagents.io';
  }
}

/**
 * Build environment configuration
 */
function buildEnvConfig(): EnvConfig {
  const environment = parseEnvironment();
  const isDev = environment === 'development';
  const authMode = parseAuthMode(getEnvVar('VITE_AUTH_MODE', 'self-hosted'));

  // Dev auto-login enabled by default in dev + self-hosted mode
  const enableDevAutoLoginDefault = isDev && authMode === 'self-hosted';
  const enableDevAutoLogin =
    getEnvVar('VITE_ENABLE_DEV_AUTO_LOGIN', '') === ''
      ? enableDevAutoLoginDefault
      : getEnvVar('VITE_ENABLE_DEV_AUTO_LOGIN', 'false') === 'true';

  return {
    environment,
    apiUrl: getEnvVar('VITE_API_URL', getDefaultApiUrl(environment)),
    wsUrl: getEnvVar('VITE_WS_URL', getDefaultWsUrl(environment)),
    authMode,
    cognito: {
      userPoolId: getEnvVar('VITE_COGNITO_USER_POOL_ID', ''),
      clientId: getEnvVar('VITE_COGNITO_CLIENT_ID', ''),
      region: getEnvVar('VITE_COGNITO_REGION', 'us-east-1'),
      domain: getEnvVar('VITE_COGNITO_DOMAIN', ''),
    },
    isDev,
    isProd: environment === 'production',
    enableMsw: getEnvVar('VITE_ENABLE_MSW', 'false') === 'true',
    enableDevAutoLogin,
    devCredentials: {
      email: getEnvVar('VITE_DEV_EMAIL', 'dev@local.test'),
      password: getEnvVar('VITE_DEV_PASSWORD', 'password123'),
    },
  };
}

/**
 * Application environment configuration
 * Reads from Vite environment variables with sensible defaults
 */
export const env: EnvConfig = buildEnvConfig();

/**
 * Validation error with detailed context
 */
export class EnvValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: string,
    public readonly value?: string
  ) {
    const valueInfo = value !== undefined ? ` (got: "${value}")` : '';
    super(`Environment validation failed for ${field}: ${reason}${valueInfo}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validate that a URL is a valid HTTP or HTTPS URL
 * @param url - The URL string to validate
 * @returns true if valid HTTP/HTTPS URL, false otherwise
 */
export function isValidHttpUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate that a URL is a valid WebSocket URL (ws:// or wss://)
 * @param url - The URL string to validate
 * @returns true if valid WebSocket URL, false otherwise
 */
export function isValidWsUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}

/**
 * Validate Cognito configuration for SaaS mode
 * @param cognito - The Cognito configuration object
 * @throws EnvValidationError if configuration is invalid
 */
export function validateCognitoConfig(cognito: CognitoConfig): void {
  if (!cognito.userPoolId || cognito.userPoolId.trim() === '') {
    throw new EnvValidationError(
      'VITE_COGNITO_USER_POOL_ID',
      'User Pool ID is required when authMode is "saas"',
      cognito.userPoolId
    );
  }

  if (!cognito.clientId || cognito.clientId.trim() === '') {
    throw new EnvValidationError(
      'VITE_COGNITO_CLIENT_ID',
      'Client ID is required when authMode is "saas"',
      cognito.clientId
    );
  }

  if (!cognito.region || cognito.region.trim() === '') {
    throw new EnvValidationError(
      'VITE_COGNITO_REGION',
      'Region is required when authMode is "saas"',
      cognito.region
    );
  }

  // Validate User Pool ID format (region_poolId)
  const userPoolIdPattern = /^[a-z]{2}-[a-z]+-\d+_[A-Za-z0-9]+$/;
  if (!userPoolIdPattern.test(cognito.userPoolId)) {
    throw new EnvValidationError(
      'VITE_COGNITO_USER_POOL_ID',
      'Invalid User Pool ID format. Expected format: region_poolId (e.g., us-east-1_abc123)',
      cognito.userPoolId
    );
  }

  // Validate region format
  const regionPattern = /^[a-z]{2}-[a-z]+-\d+$/;
  if (!regionPattern.test(cognito.region)) {
    throw new EnvValidationError(
      'VITE_COGNITO_REGION',
      'Invalid AWS region format. Expected format: us-east-1, eu-west-2, etc.',
      cognito.region
    );
  }
}

/**
 * Validate environment configuration
 * Throws if required configuration is missing or invalid
 *
 * Validates:
 * - API URL is a valid HTTP/HTTPS URL (Requirements 1.4)
 * - WebSocket URL is a valid ws:// or wss:// URL (Requirements 1.5)
 * - Cognito configuration when authMode is 'saas' (Requirements 2.2, 2.3)
 */
export function validateEnv(): void {
  // Validate API URL is present
  if (!env.apiUrl) {
    throw new EnvValidationError('VITE_API_URL', 'API URL is required');
  }

  // Validate API URL format (must be HTTP or HTTPS)
  if (!isValidHttpUrl(env.apiUrl)) {
    throw new EnvValidationError('VITE_API_URL', 'Must be a valid HTTP or HTTPS URL', env.apiUrl);
  }

  // Validate WebSocket URL is present
  if (!env.wsUrl) {
    throw new EnvValidationError('VITE_WS_URL', 'WebSocket URL is required');
  }

  // Validate WebSocket URL format (must be ws:// or wss://)
  if (!isValidWsUrl(env.wsUrl)) {
    throw new EnvValidationError(
      'VITE_WS_URL',
      'Must be a valid WebSocket URL (ws:// or wss://)',
      env.wsUrl
    );
  }

  // Validate Cognito config in SaaS mode (Requirements 2.2, 2.3)
  if (env.authMode === 'saas') {
    validateCognitoConfig(env.cognito);
  }
}

/**
 * Check if running in SaaS mode (requires Cognito auth)
 */
export function isSaasMode(): boolean {
  return env.authMode === 'saas';
}

/**
 * Check if running in self-hosted mode (local JWT auth)
 */
export function isSelfHostedMode(): boolean {
  return env.authMode === 'self-hosted';
}

/**
 * Check if MSW mocking should be enabled
 */
export function shouldEnableMsw(): boolean {
  return env.enableMsw && env.isDev;
}

/**
 * Get current environment name
 */
export function getEnvironment(): Environment {
  return env.environment;
}

/**
 * Check if dev auto-login should be used
 */
export function shouldUseDevAutoLogin(): boolean {
  return env.enableDevAutoLogin;
}

/**
 * Get dev credentials for auto-login
 */
export function getDevCredentials(): DevCredentials {
  return env.devCredentials;
}
