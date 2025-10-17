<script>
  import {QueryClient, QueryClientProvider} from '@tanstack/svelte-query';
  import Pets from '$lib/pets.svelte'

  const queryClient = new QueryClient()

</script>


<QueryClientProvider client={queryClient}>
    <Pets />
</QueryClientProvider>

