#!/usr/bin/env node
/**
 * CDK App Entry Point
 * 
 * Deploys the AccessAgents infrastructure stack.
 * Uses NODE_ENV to determine environment-specific configuration.
 * 
 * Usage:
 *   NODE_ENV=development npx cdk deploy --all
 *   NODE_ENV=staging npx cdk deploy --all
 *   NODE_ENV=production npx cdk deploy --all
 */

import 'source-map-support/register';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { BedrockStack } from '../lib/stacks/bedrock-stack';
import { getEnvironmentConfig } from '../lib/config/environments';

const app = new cdk.App();

// Get environment-specific configuration based on NODE_ENV
const envConfig = getEnvironmentConfig();

console.log(`\n🚀 Deploying AccessAgents with NODE_ENV=${envConfig.name}\n`);
console.log(`   Aurora: ${envConfig.aurora.minCapacity}-${envConfig.aurora.maxCapacity} ACU`);
console.log(`   NAT Gateways: ${envConfig.vpc.natGateways}`);
console.log(`   Lambda Memory: ${envConfig.lambda.memorySize}MB`);
console.log(`   Log Retention: ${envConfig.logging.retentionDays} days\n`);

// Get AWS environment configuration
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

// Stack naming prefix includes environment for isolation
const prefix = `accessagents-${envConfig.name}`;

// Auth Stack - Cognito User Pool
const authStack = new AuthStack(app, `${prefix}-auth`, {
    env,
    description: `AccessAgents Authentication - ${envConfig.name}`,
    envConfig,
});

// Database Stack - Aurora PostgreSQL
const databaseStack = new DatabaseStack(app, `${prefix}-database`, {
    env,
    description: `AccessAgents Database - ${envConfig.name}`,
    envConfig,
});

// API Stack - API Gateway + Lambda Functions
const apiStack = new ApiStack(app, `${prefix}-api`, {
    env,
    description: `AccessAgents API - ${envConfig.name}`,
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
    database: databaseStack.cluster,
    databaseSecret: databaseStack.secret,
    vpc: databaseStack.vpc,
    envConfig,
});

// Bedrock Stack - Bedrock Agent with Action Groups
const bedrockStack = new BedrockStack(app, `${prefix}-bedrock`, {
    env,
    description: `AccessAgents AI - ${envConfig.name}`,
    auditorLambda: apiStack.auditorLambda,
    injectorLambda: apiStack.injectorLambda,
    scanManagerLambda: apiStack.scanManagerLambda,
});

// Add dependencies
apiStack.addDependency(authStack);
apiStack.addDependency(databaseStack);
bedrockStack.addDependency(apiStack);

// Output stack information
new cdk.CfnOutput(authStack, 'UserPoolId', {
    value: authStack.userPool.userPoolId,
    exportName: `${prefix}-user-pool-id`,
});

new cdk.CfnOutput(authStack, 'UserPoolClientId', {
    value: authStack.userPoolClient.userPoolClientId,
    exportName: `${prefix}-user-pool-client-id`,
});

new cdk.CfnOutput(apiStack, 'ApiEndpoint', {
    value: apiStack.restApi.url,
    exportName: `${prefix}-api-endpoint`,
});

new cdk.CfnOutput(apiStack, 'WebSocketEndpoint', {
    value: apiStack.webSocketApi.apiEndpoint,
    exportName: `${prefix}-websocket-endpoint`,
});

app.synth();
