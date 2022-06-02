import React from 'react';
import ReactDOM from 'react-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import App from './App';
import { AuthProvider } from './auth.context';
import './index.css';
import * as serviceWorker from './serviceWorker';
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

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
