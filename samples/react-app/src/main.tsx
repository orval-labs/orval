import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import App from './App';
import { AuthProvider } from './auth.context';
import './index.css';

const queryClient = new QueryClient();

const enableMocking = async () => {
  if (import.meta.env.DEV) {
    const { setupWorker } = await import('msw/browser');
    const { getSwaggerPetstoreMock } =
      await import('./api/endpoints/petstoreFromFileSpecWithTransformer.msw');
    const worker = setupWorker(...getSwaggerPetstoreMock());
    await worker.start();
  }
};

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AuthProvider>
    </React.StrictMode>,
  );
});
