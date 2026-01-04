/**
 * AWS Amplify configuration for Cognito authentication
 * Only initializes when authMode is 'saas'
 */
import { Amplify } from 'aws-amplify';
import { env, isSaasMode } from './env';

/**
 * Configure AWS Amplify with Cognito settings
 * This should be called once at application startup, before rendering
 *
 * Only configures Amplify when running in 'saas' auth mode.
 * In 'self-hosted' mode, this function is a no-op.
 */
export function configureAmplify(): void {
  if (!isSaasMode()) {
    // Skip Amplify configuration for self-hosted mode
    return;
  }

  const { userPoolId, clientId, region } = env.cognito;

  // Validate required Cognito configuration
  if (!userPoolId || !clientId) {
    console.warn(
      'Amplify configuration skipped: Missing Cognito userPoolId or clientId. ' +
        'Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID environment variables.'
    );
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId: clientId,
        signUpVerificationMethod: 'code',
        loginWith: {
          email: true,
        },
      },
    },
  });

  if (env.isDev) {
    console.log(`Amplify configured for Cognito in region: ${region}`);
  }
}

/**
 * Check if Amplify has been configured
 * Useful for conditional logic that depends on Amplify being available
 */
export function isAmplifyConfigured(): boolean {
  if (!isSaasMode()) {
    return false;
  }

  const { userPoolId, clientId } = env.cognito;
  return Boolean(userPoolId && clientId);
}
