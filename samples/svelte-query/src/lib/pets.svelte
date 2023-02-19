<script lang="ts">
  import {createListPets} from '../api/endpoints/petstoreFromFileSpecWithTransformer';

  const pets = createListPets();
</script>

<main class="App">
    <header class="App-header">
        <img src="/logo.svg" class="App-logo" alt="logo"/>
        {#if $pets.isLoading}
            <span>Loading...</span>
        {:else if $pets.isError}
            <span>Error: {$pets.error}</span>
        {:else}
            <ul>
                {#each $pets.data as pet}
                    <li>{pet.name}</li>
                {/each}
            </ul>
        {/if}
    </header>
</main>
