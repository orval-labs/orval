import React from 'react';
import ReactDOM from 'react-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import App from './App';
import { AuthProvider } from './auth.context';
import './index.css';
import { createClient, TrpcProvider } from './trpc';

const queryClient = new QueryClient();
const trpcClient = createClient({
  url: 'http://localhost:5000/trpc',
});

ReactDOM.render(
  <React.StrictMode>
    <AuthProvider>
      <TrpcProvider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </TrpcProvider>
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
