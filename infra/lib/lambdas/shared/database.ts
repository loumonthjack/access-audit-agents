/**
 * Database Client Utility
 * 
 * Provides PostgreSQL connection pooling with Secrets Manager integration.
 * Includes RLS context setting for multi-tenant data isolation.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

interface DatabaseCredentials {
    username: string;
    password: string;
    host: string;
    port: number;
    dbname: string;
}

interface DatabaseConfig {
    secretArn: string;
    host: string;
    port: string;
    database: string;
}

// Singleton pool instance
let pool: Pool | null = null;
let cachedCredentials: DatabaseCredentials | null = null;

const secretsClient = new SecretsManagerClient({});

/**
 * Get database credentials from Secrets Manager (cached)
 */
async function getCredentials(secretArn: string): Promise<DatabaseCredentials> {
    if (cachedCredentials) {
        return cachedCredentials;
    }

    const response = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretArn })
    );

    if (!response.SecretString) {
        throw new Error('Database credentials not found in Secrets Manager');
    }

    cachedCredentials = JSON.parse(response.SecretString) as DatabaseCredentials;
    return cachedCredentials;
}

/**
 * Get or create the database connection pool
 */
export async function getPool(): Promise<Pool> {
    if (pool) {
        return pool;
    }

    const config: DatabaseConfig = {
        secretArn: process.env.DATABASE_SECRET_ARN ?? '',
        host: process.env.DATABASE_HOST ?? '',
        port: process.env.DATABASE_PORT ?? '5432',
        database: process.env.DATABASE_NAME ?? 'accessagents',
    };

    const credentials = await getCredentials(config.secretArn);

    pool = new Pool({
        host: config.host || credentials.host,
        port: parseInt(config.port, 10) || credentials.port,
        database: config.database || credentials.dbname,
        user: credentials.username,
        password: credentials.password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        ssl: { rejectUnauthorized: false },
    });

    return pool;
}

/**
 * Execute a query with organization context (RLS)
 */
export async function queryWithOrg<T extends QueryResultRow>(
    orgId: string,
    sql: string,
    params: unknown[] = []
): Promise<QueryResult<T>> {
    const dbPool = await getPool();
    const client = await dbPool.connect();

    try {
        await client.query('SELECT set_org_context($1)', [orgId]);
        return await client.query<T>(sql, params);
    } finally {
        client.release();
    }
}

/**
 * Execute a simple query without RLS context
 */
export async function query<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = []
): Promise<QueryResult<T>> {
    const dbPool = await getPool();
    return dbPool.query<T>(sql, params);
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
    orgId: string,
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    const dbPool = await getPool();
    const client = await dbPool.connect();

    try {
        await client.query('BEGIN');
        await client.query('SELECT set_org_context($1)', [orgId]);
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Close the database pool (for cleanup)
 */
export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        cachedCredentials = null;
    }
}
