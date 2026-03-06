import { VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';

import App from './App.vue';

// NEW
if (process.env.NODE_ENV === 'development') {
  import('./mock');
}

const app = createApp(App);
app.use(VueQueryPlugin);
app.mount('#app');
