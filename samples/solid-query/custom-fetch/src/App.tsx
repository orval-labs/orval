import { Component } from 'solid-js';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import Pets from './lib/Pets';
import './App.css';

const queryClient = new QueryClient();

const App: Component = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <main>
        <h1>Vite + Solid with fetch API</h1>
        <Pets />
      </main>
    </QueryClientProvider>
  );
};

export default App;
