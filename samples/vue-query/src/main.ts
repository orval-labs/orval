import { createApp } from 'vue';
import App from './App.vue';

// NEW
if (process.env.NODE_ENV === 'development') {
  import('./mock');
}

createApp(App).mount('#app');
