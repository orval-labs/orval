import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth.context';
import './index.css';

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
        <App />
      </AuthProvider>
    </React.StrictMode>,
  );
});
