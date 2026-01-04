import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// Setup MSW worker for browser (used in development)
export const worker = setupWorker(...handlers);
