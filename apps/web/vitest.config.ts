import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*'],
        },
        // Property-based testing configuration
        testTimeout: 30000, // Allow more time for property tests
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@/features': path.resolve(__dirname, './src/features'),
            '@/shared': path.resolve(__dirname, './src/shared'),
            '@/config': path.resolve(__dirname, './src/config'),
            '@/routes': path.resolve(__dirname, './src/routes'),
            '@/types': path.resolve(__dirname, './src/types'),
        },
    },
});
