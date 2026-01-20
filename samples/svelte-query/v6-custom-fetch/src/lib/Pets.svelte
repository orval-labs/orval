<script lang="ts">
  import { createListPets, createCreatePets } from "../gen/pets/pets";

  const queryResult = createListPets(() => ({ limit: "10" }), () => ({ query: { staleTime: 10000 } }));
  const mutation = createCreatePets();
  
</script>

<h2>Pets</h2>

{#if queryResult.isSuccess}
  <ul>
    {#each queryResult.data.data as pet}
      <li>{pet.name}</li>
    {/each}
  </ul>

  <button
    on:click={() => {
      mutation.mutate({ data: [{ name: 'testName', tag: 'testTag' }]})
    }}>
    Create
  </button>
{/if}
