/**
 * Database Stack - Aurora PostgreSQL Serverless v2
 * 
 * Creates VPC, Aurora cluster, and Secrets Manager secret for credentials.
 * Configuration varies based on NODE_ENV environment variable.
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config/environments';

export interface DatabaseStackProps extends cdk.StackProps {
    readonly description?: string;
    readonly envConfig: EnvironmentConfig;
}

export class DatabaseStack extends cdk.Stack {
    public readonly vpc: ec2.Vpc;
    public readonly cluster: rds.DatabaseCluster;
    public readonly secret: secretsmanager.ISecret;
    public readonly securityGroup: ec2.SecurityGroup;

    constructor(scope: Construct, id: string, props: DatabaseStackProps) {
        super(scope, id, props);

        const { envConfig } = props;

        // Create VPC with environment-specific configuration
        this.vpc = new ec2.Vpc(this, 'Vpc', {
            vpcName: `${id}-vpc`,
            maxAzs: envConfig.vpc.maxAzs,
            natGateways: envConfig.vpc.natGateways,
            subnetConfiguration: [
                {
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                },
                {
                    name: 'Private',
                    subnetType: envConfig.vpc.natGateways > 0
                        ? ec2.SubnetType.PRIVATE_WITH_EGRESS
                        : ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
                {
                    name: 'Isolated',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
            ],
        });

        // Security group for database
        this.securityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
            vpc: this.vpc,
            securityGroupName: `${id}-db-sg`,
            description: 'Security group for Aurora PostgreSQL',
            allowAllOutbound: false,
        });

        // Allow inbound PostgreSQL from within VPC
        this.securityGroup.addIngressRule(
            ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
            ec2.Port.tcp(5432),
            'Allow PostgreSQL from VPC'
        );

        // Create Aurora Serverless v2 cluster with environment-specific config
        this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
            clusterIdentifier: `${id}-cluster`,
            engine: rds.DatabaseClusterEngine.auroraPostgres({
                version: rds.AuroraPostgresEngineVersion.VER_15_8,
            }),
            credentials: rds.Credentials.fromGeneratedSecret('postgres', {
                secretName: `${id}/db-credentials`,
            }),
            defaultDatabaseName: 'accessagents',
            serverlessV2MinCapacity: envConfig.aurora.minCapacity,
            serverlessV2MaxCapacity: envConfig.aurora.maxCapacity,
            writer: rds.ClusterInstance.serverlessV2('writer', {
                publiclyAccessible: false,
            }),
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
            securityGroups: [this.securityGroup],
            storageEncrypted: true,
            deletionProtection: envConfig.aurora.deletionProtection,
            removalPolicy: envConfig.isProduction
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
            backup: {
                retention: cdk.Duration.days(envConfig.aurora.backupRetentionDays),
            },
        });

        // Get the generated secret
        this.secret = this.cluster.secret!;

        // Add VPC endpoints for AWS services (required when NAT gateways = 0)
        // This allows Lambdas in private subnets to access AWS services
        if (envConfig.vpc.natGateways === 0) {
            // Secrets Manager endpoint (for database credentials)
            this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
                service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
                subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            });

            // SSM endpoint (for reading Bedrock Agent IDs)
            this.vpc.addInterfaceEndpoint('SSMEndpoint', {
                service: ec2.InterfaceVpcEndpointAwsService.SSM,
                subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            });

            // Bedrock Runtime endpoint (for invoking Bedrock agents)
            this.vpc.addInterfaceEndpoint('BedrockRuntimeEndpoint', {
                service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
                subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            });

            // Bedrock Agent Runtime endpoint (for invoking Bedrock agents)
            this.vpc.addInterfaceEndpoint('BedrockAgentRuntimeEndpoint', {
                service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_AGENT_RUNTIME,
                subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            });

            // API Gateway Management endpoint (for WebSocket notifications)
            this.vpc.addInterfaceEndpoint('ApiGatewayEndpoint', {
                service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
                subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            });

            // Lambda endpoint (for invoking other Lambda functions)
            this.vpc.addInterfaceEndpoint('LambdaEndpoint', {
                service: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
                subnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            });
        }

        // Output connection info
        new cdk.CfnOutput(this, 'ClusterEndpoint', {
            value: this.cluster.clusterEndpoint.hostname,
            description: 'Aurora cluster endpoint',
        });

        new cdk.CfnOutput(this, 'SecretArn', {
            value: this.secret.secretArn,
            description: 'Database credentials secret ARN',
        });

        new cdk.CfnOutput(this, 'Environment', {
            value: envConfig.name,
            description: 'Deployment environment',
        });
    }
}
