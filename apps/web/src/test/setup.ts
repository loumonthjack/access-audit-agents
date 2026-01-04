import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, beforeEach } from 'vitest';
import { server } from './mocks/server';
import { resetMockData, mockWsServer } from './mocks/handlers';

// Polyfill ResizeObserver for HeadlessUI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// MSW setup
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

// Reset mock data before each test
beforeEach(() => {
  resetMockData();
  mockWsServer.clear();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
