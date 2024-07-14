<script lang="ts">
  import { createListPets, createCreatePets } from "../gen/pets/pets";

  const queryResult = createListPets();
  const mutation = createCreatePets();
  
</script>

<h2>Pets</h2>

{#if $queryResult.data}
  <ul>
    {#each $queryResult.data.data as pet}
      <li>{pet.name}</li>
    {/each}
  </ul>

  <button
    on:click={() => {
      $mutation.mutate({ data: [{ name: 'testName', tag: 'testTag' }]})
    }}>
    Create
  </button>
{/if}
