import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
/* @refresh reload */
import { render } from 'solid-js/web';

import App from './App';
import './index.css';

const queryClient = new QueryClient();

const root = document.getElementById('root');

async function startApp() {
  if (import.meta.env.DEV) {
    const { initMocks } = await import('./mocks');
    await initMocks();
    // Give MSW a moment to fully activate the service worker
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log('✅ Mocks initialized and ready, rendering app...');
  }

  render(
    () => (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    ),
    root!,
  );
}

startApp();
