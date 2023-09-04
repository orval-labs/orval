<template>
  <div class="App">
    <header class="App-header">
      <img src="./assets/logo.svg" class="App-logo" alt="logo" />
      <Pet
        v-if="selectedPetId"
        :key="selectedPetId"
        :pet-id="selectedPetId"
        :id="'selected-pet-' + selectedPetId"
      />
      <Pets @[SELECT_PET_ID_EVENT]="selectedPetId = $event" />
    </header>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { SELECT_PET_ID_EVENT } from './constants';

import Pets from './components/pets.vue';
import Pet from './components/pet.vue';

export default defineComponent({
  name: 'App',
  components: { Pets, Pet },
  setup() {
    const selectedPetId = ref();

    return { selectedPetId, SELECT_PET_ID_EVENT };
  },
});
</script>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scroll-behavior: smooth;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}

.App {
  text-align: center;
}

.App-header {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: black;
}

.App-logo {
  width: 100%;
}
</style>
