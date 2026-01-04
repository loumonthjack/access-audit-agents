import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/config/router';
import { configureAmplify } from '@/config/amplify';
import './index.css';

// Initialize AWS Amplify for Cognito authentication (only in saas mode)
configureAmplify();

async function enableMocking() {
    // Only enable MSW when explicitly requested via VITE_ENABLE_MSW=true
    // This prevents mock handlers from intercepting real AWS API calls
    if (import.meta.env.VITE_ENABLE_MSW === 'true') {
        const { worker } = await import('@/test/mocks/browser');
        return worker.start({
            onUnhandledRequest: 'bypass',
        });
    }
    return Promise.resolve();
}

enableMocking().then(() => {
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <RouterProvider router={router} />
        </StrictMode>
    );
});
