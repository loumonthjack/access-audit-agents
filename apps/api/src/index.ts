/**
 * Local Express API Server
 * 
 * Provides REST API endpoints for the AccessAgents frontend,
 * connecting to local PostgreSQL and AWS Bedrock Agent.
 */

// Load environment variables BEFORE any other imports
// This ensures .env values are available when modules initialize
import { config } from 'dotenv';
config();

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { scanRoutes } from './routes/scans.js';
import { authRoutes } from './routes/auth.js';
import { sessionRoutes } from './routes/sessions.js';
import { reportRoutes } from './routes/reports.js';
import { sitemapRoutes } from './routes/sitemaps.js';
import { batchScanRoutes } from './routes/batch-scans.js';
import { initializeDatabase } from './services/database.js';
import { initializeWebSocket } from './services/websocket.js';

const PORT = process.env.PORT ?? 3001;

const app = express();
const server = createServer(app);

app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
}));

app.use(express.json());

app.use((request, _response, next) => {
    console.log(`${request.method} ${request.path}`);
    next();
});

app.get('/api/health', (_request, response) => {
    response.json({
        status: 'healthy',
        environment: 'development',
        timestamp: new Date().toISOString(),
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sitemaps', sitemapRoutes);
app.use('/api/batch-scans', batchScanRoutes);

app.use((_request, response) => {
    response.status(404).json({
        code: 'NOT_FOUND',
        message: 'Route not found',
    });
});

const webSocketServer = new WebSocketServer({ server, path: '/ws' });
initializeWebSocket(webSocketServer);

async function start(): Promise<void> {
    try {
        await initializeDatabase();
        console.log('Database connected');

        server.listen(PORT, () => {
            console.log(`API server running on http://localhost:${PORT}`);
            console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();

