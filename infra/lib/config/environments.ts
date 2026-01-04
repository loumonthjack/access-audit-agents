/**
 * Environment Configuration
 * 
 * Defines environment-specific settings for development, staging, and production.
 * Uses NODE_ENV to determine which configuration to use.
 */

export type Environment = 'development' | 'staging' | 'production';

export interface AuroraConfig {
    /** Minimum ACU (0 = scales to zero when idle) */
    minCapacity: number;
    /** Maximum ACU for scaling */
    maxCapacity: number;
    /** Prevent accidental deletion */
    deletionProtection: boolean;
    /** Backup retention in days */
    backupRetentionDays: number;
}

export interface VpcConfig {
    /** Number of NAT gateways (0 = no internet for private subnets) */
    natGateways: number;
    /** Maximum availability zones */
    maxAzs: number;
}

export interface LambdaConfig {
    /** Memory allocation in MB */
    memorySize: number;
    /** Timeout in seconds */
    timeout: number;
}

export interface LoggingConfig {
    /** CloudWatch log retention in days */
    retentionDays: number;
}

export interface EnvironmentConfig {
    /** Environment name */
    name: Environment;
    /** Aurora PostgreSQL configuration */
    aurora: AuroraConfig;
    /** VPC networking configuration */
    vpc: VpcConfig;
    /** Lambda function configuration */
    lambda: LambdaConfig;
    /** Logging configuration */
    logging: LoggingConfig;
    /** Whether this is a production environment */
    isProduction: boolean;
}

/**
 * Environment-specific configurations
 */
export const environments: Record<Environment, EnvironmentConfig> = {
    development: {
        name: 'development',
        aurora: {
            minCapacity: 0,
            maxCapacity: 2,
            deletionProtection: false,
            backupRetentionDays: 1,
        },
        vpc: {
            natGateways: 0, // No NAT needed - Auditor/Injector Lambdas are outside VPC
            maxAzs: 2,
        },
        lambda: {
            memorySize: 512,
            timeout: 30,
        },
        logging: {
            retentionDays: 3,
        },
        isProduction: false,
    },
    staging: {
        name: 'staging',
        aurora: {
            minCapacity: 0,
            maxCapacity: 4,
            deletionProtection: false,
            backupRetentionDays: 7,
        },
        vpc: {
            natGateways: 0,
            maxAzs: 2,
        },
        lambda: {
            memorySize: 1024,
            timeout: 60,
        },
        logging: {
            retentionDays: 14,
        },
        isProduction: false,
    },
    production: {
        name: 'production',
        aurora: {
            minCapacity: 0.5,
            maxCapacity: 16,
            deletionProtection: true,
            backupRetentionDays: 30,
        },
        vpc: {
            natGateways: 2,
            maxAzs: 3,
        },
        lambda: {
            memorySize: 2048,
            timeout: 300,
        },
        logging: {
            retentionDays: 90,
        },
        isProduction: true,
    },
};

/**
 * Get configuration for current environment
 */
export function getEnvironmentConfig(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV ?? 'development';

    if (nodeEnv in environments) {
        return environments[nodeEnv as Environment];
    }

    console.warn(`Unknown NODE_ENV: ${nodeEnv}, defaulting to development`);
    return environments.development;
}

/**
 * Get current environment name
 */
export function getEnvironmentName(): Environment {
    return getEnvironmentConfig().name;
}

/**
 * Check if current environment is production
 */
export function isProduction(): boolean {
    return getEnvironmentConfig().isProduction;
}

