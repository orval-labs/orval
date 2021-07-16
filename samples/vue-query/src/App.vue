<template>
  <div className="App">
    <header className="App-header">
      <img src="./assets/logo.svg" className="App-logo" alt="logo" />
      <Pets />
    </header>
  </div>
  <VueQueryDevTools />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useQueryProvider } from 'vue-query';
import { VueQueryDevTools } from 'vue-query/devtools';

import Pets from './components/pets.vue';

export default defineComponent({
  name: 'App',
  components: { VueQueryDevTools, Pets },
  setup() {
    useQueryProvider();
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
