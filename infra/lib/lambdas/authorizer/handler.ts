/**
 * Lambda Authorizer
 * 
 * Validates Cognito JWT tokens and generates IAM policies.
 * Supports both REST API and WebSocket API authorization.
 */

import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type {
    APIGatewayTokenAuthorizerEvent,
    APIGatewayRequestAuthorizerEvent,
    APIGatewayAuthorizerResult,
    PolicyDocument,
} from 'aws-lambda';

const USER_POOL_ID = process.env.USER_POOL_ID ?? '';
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID ?? '';

// Create verifiers for both ID and access tokens
const idTokenVerifier = CognitoJwtVerifier.create({
    userPoolId: USER_POOL_ID,
    tokenUse: 'id',
    clientId: USER_POOL_CLIENT_ID,
});

const accessTokenVerifier = CognitoJwtVerifier.create({
    userPoolId: USER_POOL_ID,
    tokenUse: 'access',
    clientId: USER_POOL_CLIENT_ID,
});

interface TokenPayload {
    sub: string;
    email?: string;
    'custom:orgId'?: string;
    token_use: 'id' | 'access';
}

/**
 * Generate IAM policy document
 */
function generatePolicy(
    principalId: string,
    effect: 'Allow' | 'Deny',
    resource: string,
    context?: Record<string, string | number | boolean>
): APIGatewayAuthorizerResult {
    const policyDocument: PolicyDocument = {
        Version: '2012-10-17',
        Statement: [{
            Action: 'execute-api:Invoke',
            Effect: effect,
            Resource: resource,
        }],
    };

    return {
        principalId,
        policyDocument,
        context: context ?? {},
    };
}

/**
 * Generate wildcard resource ARN for caching
 */
function getWildcardResource(methodArn: string): string {
    const parts = methodArn.split('/');
    if (parts.length >= 2) {
        parts[parts.length - 1] = '*';
        parts[parts.length - 2] = '*';
    }
    return parts.join('/');
}

/**
 * Extract token from authorization header or query string
 */
function extractToken(event: APIGatewayTokenAuthorizerEvent | APIGatewayRequestAuthorizerEvent): string | null {
    // Token authorizer
    if ('authorizationToken' in event && event.authorizationToken) {
        const header = event.authorizationToken;
        return header.startsWith('Bearer ') ? header.slice(7) : header;
    }

    // Request authorizer (WebSocket uses query params)
    if ('queryStringParameters' in event && event.queryStringParameters?.token) {
        return event.queryStringParameters.token;
    }

    // Request authorizer with headers
    if ('headers' in event) {
        const authHeader = event.headers?.Authorization ?? event.headers?.authorization;
        if (authHeader) {
            return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        }
    }

    return null;
}

/**
 * Verify token with appropriate verifier
 */
async function verifyToken(token: string): Promise<TokenPayload> {
    try {
        // Try ID token first (most common for web apps)
        const payload = await idTokenVerifier.verify(token);
        return payload as unknown as TokenPayload;
    } catch {
        // Fall back to access token
        const payload = await accessTokenVerifier.verify(token);
        return payload as unknown as TokenPayload;
    }
}

/**
 * Main Lambda handler
 */
export async function handler(
    event: APIGatewayTokenAuthorizerEvent | APIGatewayRequestAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
    const methodArn = event.methodArn;
    
    console.log('Authorizer event:', {
        type: 'type' in event ? event.type : 'REQUEST',
        methodArn,
    });

    const token = extractToken(event);

    if (!token) {
        console.error('No token found');
        return generatePolicy('unauthorized', 'Deny', methodArn, { error: 'Missing token' });
    }

    try {
        const payload = await verifyToken(token);

        console.log('Token verified:', { sub: payload.sub, email: payload.email });

        const userId = payload.sub;
        const email = payload.email ?? '';
        const orgId = payload['custom:orgId'] ?? '00000000-0000-0000-0000-000000000000';

        // Use wildcard resource for policy caching
        const resource = getWildcardResource(methodArn);

        return generatePolicy(userId, 'Allow', resource, { userId, email, orgId });
    } catch (error) {
        console.error('Token verification failed:', error);
        return generatePolicy('unauthorized', 'Deny', methodArn, { error: 'Invalid token' });
    }
}
