import './App.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Pets from './pets';

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <Pets />
      </div>
    </QueryClientProvider>
  );
}

export default App;
