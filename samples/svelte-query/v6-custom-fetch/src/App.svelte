<script lang="ts">
  import Pets from './lib/Pets.svelte';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query'

  const queryClient = new QueryClient()
</script>

<main>
  <QueryClientProvider client={queryClient}>
    <h1>Vite + Svelte with fetch api</h1>
    
    <Pets />    
  </QueryClientProvider>
</main>
