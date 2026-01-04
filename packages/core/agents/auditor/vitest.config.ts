import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: [
            'src/**/*.test.ts',
            'src/**/*.property.test.ts'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.property.test.ts',
                'src/__fixtures__/**',
                'src/__generators__/**'
            ]
        },
        testTimeout: 30000,
        hookTimeout: 30000
    }
});
