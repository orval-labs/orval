import { createApp } from 'vue';
import App from './App.vue';
import { VueQueryPlugin } from '@tanstack/vue-query';

// NEW
if (import.meta.env.DEV) {
  import('./mock');
}

const app = createApp(App);
app.use(VueQueryPlugin);
app.mount('#app');
