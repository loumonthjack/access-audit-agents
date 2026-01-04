/**
 * Auth Stack - Cognito User Pool
 * 
 * Creates Amazon Cognito User Pool for authentication.
 * Supports email-based sign-up with verification.
 * Configuration varies based on NODE_ENV environment variable.
 */

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config/environments';

export interface AuthStackProps extends cdk.StackProps {
    readonly description?: string;
    readonly envConfig: EnvironmentConfig;
}

export class AuthStack extends cdk.Stack {
    public readonly userPool: cognito.UserPool;
    public readonly userPoolClient: cognito.UserPoolClient;
    public readonly identityPool: cognito.CfnIdentityPool;

    constructor(scope: Construct, id: string, props: AuthStackProps) {
        super(scope, id, props);

        const { envConfig } = props;

        // Define callback URLs based on environment
        const callbackUrls = envConfig.isProduction
            ? ['https://app.accessagents.io/callback']
            : [
                'http://localhost:5173/callback',
                'http://localhost:3000/callback',
            ];

        const logoutUrls = envConfig.isProduction
            ? ['https://app.accessagents.io']
            : [
                'http://localhost:5173',
                'http://localhost:3000',
            ];

        // Create User Pool
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: `${id}-users`,
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
            },
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true,
                },
                fullname: {
                    required: false,
                    mutable: true,
                },
            },
            customAttributes: {
                orgId: new cognito.StringAttribute({
                    mutable: true,
                }),
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: envConfig.isProduction,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: envConfig.isProduction
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
        });

        // Create User Pool Client for web app
        this.userPoolClient = new cognito.UserPoolClient(this, 'WebAppClient', {
            userPool: this.userPool,
            userPoolClientName: `${id}-web-client`,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.PROFILE,
                ],
                callbackUrls,
                logoutUrls,
            },
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.COGNITO,
            ],
            preventUserExistenceErrors: true,
            generateSecret: false,
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            refreshTokenValidity: cdk.Duration.days(30),
        });

        // Create Identity Pool for IAM credentials (optional, for S3 direct upload)
        this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
            identityPoolName: `${id}_identity_pool`,
            allowUnauthenticatedIdentities: false,
            cognitoIdentityProviders: [
                {
                    clientId: this.userPoolClient.userPoolClientId,
                    providerName: this.userPool.userPoolProviderName,
                },
            ],
        });

        // Create User Pool Domain for hosted UI
        this.userPool.addDomain('CognitoDomain', {
            cognitoDomain: {
                domainPrefix: `${id}-${this.account}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            },
        });

        // Output environment info
        new cdk.CfnOutput(this, 'Environment', {
            value: envConfig.name,
            description: 'Deployment environment',
        });
    }
}
