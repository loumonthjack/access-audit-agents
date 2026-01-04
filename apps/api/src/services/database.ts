/**
 * Database Service
 * 
 * PostgreSQL connection management for local development.
 */

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
    if (!pool) {
        throw new Error('Database not initialized. Call initializeDatabase first.');
    }
    return pool;
}

export async function initializeDatabase(): Promise<void> {
    const connectionString = process.env.DATABASE_URL 
        ?? 'postgresql://postgres:localdev123@localhost:5432/accessagents';

    pool = new Pool({ connectionString });

    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
    } finally {
        client.release();
    }
}

export async function query<T extends pg.QueryResultRow>(
    text: string,
    params?: unknown[]
): Promise<pg.QueryResult<T>> {
    const database = getPool();
    return database.query<T>(text, params);
}

export async function transaction<T>(
    callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
    const database = getPool();
    const client = await database.connect();
    
    try {
        await client.query('BEGIN');
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

export async function closeDatabase(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
    }
}

