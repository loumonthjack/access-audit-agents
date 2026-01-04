/**
 * API Stack - REST and WebSocket API Gateway with Lambda Functions
 * 
 * Creates API Gateway endpoints, Lambda functions for scan management,
 * and WebSocket handlers for real-time progress updates.
 * Configuration varies based on NODE_ENV environment variable.
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';
import * as path from 'path';
import type { EnvironmentConfig } from '../config/environments';

export interface ApiStackProps extends cdk.StackProps {
    readonly description?: string;
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly database: rds.DatabaseCluster;
    readonly databaseSecret: secretsmanager.ISecret;
    readonly vpc: ec2.Vpc;
    readonly envConfig: EnvironmentConfig;
}

export class ApiStack extends cdk.Stack {
    public readonly restApi: apigateway.RestApi;
    public readonly webSocketApi: apigatewayv2.WebSocketApi;
    public readonly auditorLambda: lambda.Function;
    public readonly injectorLambda: lambda.Function;
    public readonly scanManagerLambda: lambda.Function;
    public readonly migrationRunnerLambda: lambda.Function;
    public readonly sitemapParserLambda: lambda.Function;
    public readonly batchOrchestratorLambda: lambda.Function;

    constructor(scope: Construct, id: string, props: ApiStackProps) {
        super(scope, id, props);

        const { userPool, userPoolClient, database, databaseSecret, vpc, envConfig } = props;

        // Determine subnet type based on NAT availability
        const privateSubnetType = envConfig.vpc.natGateways > 0
            ? ec2.SubnetType.PRIVATE_WITH_EGRESS
            : ec2.SubnetType.PRIVATE_ISOLATED;

        // Map retention days to CloudWatch enum
        const logRetention = this.getLogRetention(envConfig.logging.retentionDays);

        // Lambda security group
        const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
            vpc,
            description: 'Security group for Lambda functions',
            allowAllOutbound: true,
        });

        // Common Lambda environment variables
        const commonEnv = {
            DATABASE_SECRET_ARN: databaseSecret.secretArn,
            DATABASE_HOST: database.clusterEndpoint.hostname,
            DATABASE_PORT: '5432',
            DATABASE_NAME: 'accessagents',
            NODE_OPTIONS: '--enable-source-maps',
            NODE_ENV: envConfig.name,
        };

        // Lambda execution role with database access
        const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
            ],
        });

        // Grant secret read access
        databaseSecret.grantRead(lambdaRole);

        // Common bundling options for Playwright-based Lambdas
        // playwright-core and its dependencies must be external because they can't be bundled
        const playwrightBundling: lambdaNodejs.BundlingOptions = {
            minify: true,
            sourceMap: true,
            externalModules: [
                '@aws-sdk/*',
                'playwright-core',
                'chromium-bidi',
                '@axe-core/playwright',
            ],
            nodeModules: [
                'playwright-core',
                'chromium-bidi',
                '@axe-core/playwright',
            ],
        };

        // Auditor Lambda - runs axe-core scans
        // NOTE: Auditor Lambda is NOT in VPC because it needs internet access to Browserless.io
        // and doesn't need direct database access (it's invoked by Bedrock Agent)
        this.auditorLambda = new lambdaNodejs.NodejsFunction(this, 'AuditorLambda', {
            functionName: `${id}-auditor`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambdas/auditor/handler.ts'),
            timeout: cdk.Duration.seconds(Math.max(envConfig.lambda.timeout, 60)), // Needs time for browser operations
            memorySize: Math.max(envConfig.lambda.memorySize, 2048), // Playwright needs more memory
            // No VPC - needs internet access to Browserless.io
            environment: {
                BROWSER_MODE: 'browserless',
                BROWSERLESS_ENDPOINT: process.env.BROWSERLESS_ENDPOINT ?? '',
                BROWSERLESS_API_KEY: process.env.BROWSERLESS_API_KEY ?? '',
                NODE_OPTIONS: '--enable-source-maps',
                NODE_ENV: envConfig.name,
            },
            bundling: playwrightBundling,
            logRetention,
        });

        // Injector Lambda - applies DOM fixes
        // NOTE: Injector Lambda is NOT in VPC because it needs internet access to Browserless.io
        // and doesn't need direct database access (it's invoked by Bedrock Agent)
        this.injectorLambda = new lambdaNodejs.NodejsFunction(this, 'InjectorLambda', {
            functionName: `${id}-injector`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambdas/injector/handler.ts'),
            timeout: cdk.Duration.seconds(Math.max(envConfig.lambda.timeout, 60)), // Needs time for browser operations
            memorySize: Math.max(envConfig.lambda.memorySize, 1024), // Playwright needs more memory
            // No VPC - needs internet access to Browserless.io
            environment: {
                BROWSER_MODE: 'browserless',
                BROWSERLESS_ENDPOINT: process.env.BROWSERLESS_ENDPOINT ?? '',
                BROWSERLESS_API_KEY: process.env.BROWSERLESS_API_KEY ?? '',
                NODE_OPTIONS: '--enable-source-maps',
                NODE_ENV: envConfig.name,
            },
            bundling: playwrightBundling,
            logRetention,
        });

        // Scan Manager Lambda - orchestrates scans
        this.scanManagerLambda = new lambdaNodejs.NodejsFunction(this, 'ScanManagerLambda', {
            functionName: `${id}-scan-manager`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambdas/scan-manager/handler.ts'),
            timeout: cdk.Duration.seconds(envConfig.lambda.timeout * 5), // Longer for orchestration
            memorySize: envConfig.lambda.memorySize,
            vpc,
            vpcSubnets: { subnetType: privateSubnetType },
            securityGroups: [lambdaSecurityGroup],
            environment: {
                ...commonEnv,
                USER_POOL_ID: userPool.userPoolId,
                // SSM parameter names for Bedrock Agent IDs (created by BedrockStack)
                BEDROCK_AGENT_ID_PARAM: '/accessagents/bedrock/agent-id',
                BEDROCK_AGENT_ALIAS_ID_PARAM: '/accessagents/bedrock/agent-alias-id',
                // Auditor Lambda function name for direct invocation
                AUDITOR_FUNCTION_NAME: `${id}-auditor`,
            },
            role: lambdaRole,
            bundling: {
                minify: true,
                sourceMap: true,
                externalModules: ['@aws-sdk/*'],
            },
            logRetention,
        });

        // Grant Bedrock invoke permissions to scan manager
        this.scanManagerLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'bedrock:InvokeAgent',
                'bedrock:InvokeAgentWithResponseStream',
            ],
            resources: ['*'],
        }));

        // Grant SSM read permissions for Bedrock Agent IDs
        this.scanManagerLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['ssm:GetParameter'],
            resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/accessagents/bedrock/*`,
            ],
        }));

        // Grant permission to invoke Auditor Lambda directly
        this.auditorLambda.grantInvoke(this.scanManagerLambda);

        // Migration Runner Lambda - applies database schema
        this.migrationRunnerLambda = new lambdaNodejs.NodejsFunction(this, 'MigrationRunnerLambda', {
            functionName: `${id}-migration-runner`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambdas/migration-runner/handler.ts'),
            timeout: cdk.Duration.seconds(300), // 5 minutes for migrations
            memorySize: 256,
            vpc,
            vpcSubnets: { subnetType: privateSubnetType },
            securityGroups: [lambdaSecurityGroup],
            environment: commonEnv,
            role: lambdaRole,
            bundling: {
                minify: true,
                sourceMap: true,
                externalModules: ['@aws-sdk/*'],
            },
            logRetention,
        });

        // Sitemap Parser Lambda - parses sitemap XML files
        // NOTE: Sitemap Parser is NOT in VPC because it needs internet access to fetch sitemaps
        this.sitemapParserLambda = new lambdaNodejs.NodejsFunction(this, 'SitemapParserLambda', {
            functionName: `${id}-sitemap-parser`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambdas/sitemap-parser/handler.ts'),
            timeout: cdk.Duration.seconds(60), // Needs time to fetch and parse sitemaps
            memorySize: 256,
            // No VPC - needs internet access to fetch sitemaps
            environment: {
                NODE_OPTIONS: '--enable-source-maps',
                NODE_ENV: envConfig.name,
            },
            bundling: {
                minify: true,
                sourceMap: true,
                externalModules: ['@aws-sdk/*'],
            },
            logRetention,
        });

        // Batch Orchestrator Lambda - orchestrates batch scans
        this.batchOrchestratorLambda = new lambdaNodejs.NodejsFunction(this, 'BatchOrchestratorLambda', {
            functionName: `${id}-batch-orchestrator`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambdas/batch-orchestrator/handler.ts'),
            timeout: cdk.Duration.seconds(envConfig.lambda.timeout * 5), // Longer for batch processing
            memorySize: envConfig.lambda.memorySize,
            vpc,
            vpcSubnets: { subnetType: privateSubnetType },
            securityGroups: [lambdaSecurityGroup],
            environment: {
                ...commonEnv,
                USER_POOL_ID: userPool.userPoolId,
                WEBSOCKET_ENDPOINT: '', // Will be set after WebSocket API is created
            },
            role: lambdaRole,
            bundling: {
                minify: true,
                sourceMap: true,
                externalModules: ['@aws-sdk/*'],
            },
            logRetention,
        });

        // WebSocket Handler Lambda
        const webSocketHandler = new lambdaNodejs.NodejsFunction(this, 'WebSocketHandler', {
            functionName: `${id}-websocket`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambdas/websocket/handler.ts'),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            vpc,
            vpcSubnets: { subnetType: privateSubnetType },
            securityGroups: [lambdaSecurityGroup],
            environment: commonEnv,
            role: lambdaRole,
            bundling: {
                minify: true,
                sourceMap: true,
                externalModules: ['@aws-sdk/*'],
            },
            logRetention,
        });

        // Lambda Authorizer
        const authorizerLambda = new lambdaNodejs.NodejsFunction(this, 'AuthorizerLambda', {
            functionName: `${id}-authorizer`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'handler',
            entry: path.join(__dirname, '../lambdas/authorizer/handler.ts'),
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
                USER_POOL_ID: userPool.userPoolId,
                USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
                COGNITO_REGION: this.region,
            },
            bundling: {
                minify: true,
                sourceMap: true,
                externalModules: ['@aws-sdk/*'],
            },
            logRetention,
        });

        // REST API
        this.restApi = new apigateway.RestApi(this, 'RestApi', {
            restApiName: `${id}-rest`,
            description: `AccessAgents REST API (${envConfig.name})`,
            deployOptions: {
                stageName: envConfig.name === 'production' ? 'prod' : envConfig.name,
                throttlingBurstLimit: envConfig.isProduction ? 100 : 20,
                throttlingRateLimit: envConfig.isProduction ? 50 : 10,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });

        // Cognito Authorizer
        const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [userPool],
            authorizerName: 'CognitoAuthorizer',
        });

        // API Resources
        const scansResource = this.restApi.root.addResource('scans');
        const scanIdResource = scansResource.addResource('{sessionId}');
        const sessionsResource = this.restApi.root.addResource('sessions');
        const sessionIdResource = sessionsResource.addResource('{sessionId}');
        const reportsResource = this.restApi.root.addResource('reports');
        const reportIdResource = reportsResource.addResource('{sessionId}');
        const reportExportResource = reportIdResource.addResource('export');

        // Lambda integrations
        const scanManagerIntegration = new apigateway.LambdaIntegration(this.scanManagerLambda);

        // Route definitions
        scansResource.addMethod('POST', scanManagerIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        scanIdResource.addMethod('GET', scanManagerIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        sessionsResource.addMethod('GET', scanManagerIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        sessionIdResource.addMethod('DELETE', scanManagerIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        reportIdResource.addMethod('GET', scanManagerIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // Report export endpoint (Requirements: 5.5)
        reportExportResource.addMethod('GET', scanManagerIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // Health check endpoint (no auth) - with CORS headers
        const healthResource = this.restApi.root.addResource('health');
        healthResource.addMethod('GET', new apigateway.MockIntegration({
            integrationResponses: [{
                statusCode: '200',
                responseTemplates: {
                    'application/json': JSON.stringify({
                        status: 'healthy',
                        environment: envConfig.name,
                    }),
                },
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': "'*'",
                    'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'",
                    'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
                },
            }],
            requestTemplates: {
                'application/json': '{"statusCode": 200}',
            },
        }), {
            methodResponses: [{
                statusCode: '200',
                responseParameters: {
                    'method.response.header.Access-Control-Allow-Origin': true,
                    'method.response.header.Access-Control-Allow-Headers': true,
                    'method.response.header.Access-Control-Allow-Methods': true,
                },
            }],
        });

        // ============================================================================
        // Sitemap Parser Endpoints
        // ============================================================================
        const sitemapsResource = this.restApi.root.addResource('sitemaps');
        const sitemapParseResource = sitemapsResource.addResource('parse');
        const sitemapParserIntegration = new apigateway.LambdaIntegration(this.sitemapParserLambda);

        // POST /sitemaps/parse - Parse a sitemap URL
        sitemapParseResource.addMethod('POST', sitemapParserIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // ============================================================================
        // Batch Scan Endpoints
        // ============================================================================
        const batchScansResource = this.restApi.root.addResource('batch-scans');
        const batchIdResource = batchScansResource.addResource('{batchId}');
        const batchPagesResource = batchIdResource.addResource('pages');
        const batchReportResource = batchIdResource.addResource('report');
        const batchPauseResource = batchIdResource.addResource('pause');
        const batchResumeResource = batchIdResource.addResource('resume');
        const batchCancelResource = batchIdResource.addResource('cancel');
        const batchOrchestratorIntegration = new apigateway.LambdaIntegration(this.batchOrchestratorLambda);

        // POST /batch-scans - Create a new batch scan
        batchScansResource.addMethod('POST', batchOrchestratorIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // GET /batch-scans/{batchId} - Get batch scan status
        batchIdResource.addMethod('GET', batchOrchestratorIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // GET /batch-scans/{batchId}/pages - Get batch pages
        batchPagesResource.addMethod('GET', batchOrchestratorIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // GET /batch-scans/{batchId}/report - Get batch report
        batchReportResource.addMethod('GET', batchOrchestratorIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // POST /batch-scans/{batchId}/pause - Pause batch scan
        batchPauseResource.addMethod('POST', batchOrchestratorIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // POST /batch-scans/{batchId}/resume - Resume batch scan
        batchResumeResource.addMethod('POST', batchOrchestratorIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // POST /batch-scans/{batchId}/cancel - Cancel batch scan
        batchCancelResource.addMethod('POST', batchOrchestratorIntegration, {
            authorizer: cognitoAuthorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });

        // WebSocket API
        this.webSocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
            apiName: `${id}-websocket`,
            description: `AccessAgents WebSocket API (${envConfig.name})`,
            connectRouteOptions: {
                integration: new apigatewayv2Integrations.WebSocketLambdaIntegration(
                    'ConnectIntegration',
                    webSocketHandler
                ),
            },
            disconnectRouteOptions: {
                integration: new apigatewayv2Integrations.WebSocketLambdaIntegration(
                    'DisconnectIntegration',
                    webSocketHandler
                ),
            },
            defaultRouteOptions: {
                integration: new apigatewayv2Integrations.WebSocketLambdaIntegration(
                    'DefaultIntegration',
                    webSocketHandler
                ),
            },
        });

        // WebSocket Stage
        const webSocketStage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
            webSocketApi: this.webSocketApi,
            stageName: envConfig.name === 'production' ? 'prod' : envConfig.name,
            autoDeploy: true,
        });

        // Grant WebSocket management permissions
        webSocketHandler.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/*`,
            ],
        }));

        // Add WebSocket endpoint to scan manager environment
        this.scanManagerLambda.addEnvironment(
            'WEBSOCKET_ENDPOINT',
            `${this.webSocketApi.apiEndpoint}/${webSocketStage.stageName}`
        );

        // Add WebSocket endpoint to batch orchestrator environment
        this.batchOrchestratorLambda.addEnvironment(
            'WEBSOCKET_ENDPOINT',
            `${this.webSocketApi.apiEndpoint}/${webSocketStage.stageName}`
        );

        // Grant WebSocket management permissions to batch orchestrator
        this.batchOrchestratorLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:${this.webSocketApi.apiId}/*`,
            ],
        }));

        // Output migration runner Lambda name for manual invocation
        new cdk.CfnOutput(this, 'MigrationRunnerLambdaName', {
            value: this.migrationRunnerLambda.functionName,
            description: 'Migration runner Lambda function name',
        });
    }

    /**
     * Map retention days to CloudWatch RetentionDays enum
     */
    private getLogRetention(days: number): logs.RetentionDays {
        if (days <= 1) return logs.RetentionDays.ONE_DAY;
        if (days <= 3) return logs.RetentionDays.THREE_DAYS;
        if (days <= 5) return logs.RetentionDays.FIVE_DAYS;
        if (days <= 7) return logs.RetentionDays.ONE_WEEK;
        if (days <= 14) return logs.RetentionDays.TWO_WEEKS;
        if (days <= 30) return logs.RetentionDays.ONE_MONTH;
        if (days <= 60) return logs.RetentionDays.TWO_MONTHS;
        if (days <= 90) return logs.RetentionDays.THREE_MONTHS;
        return logs.RetentionDays.SIX_MONTHS;
    }
}
