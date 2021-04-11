<script>
	import { QueryClient, QueryClientProvider } from '@sveltestack/svelte-query';
	import { useListPets } from '../api/endpoints/petstoreFromFileSpecWithTransformer';
	import Pets from '$lib/pets.svelte'

	const queryClient = new QueryClient()

</script>


<QueryClientProvider client={queryClient}>
	<Pets />
</QueryClientProvider>

