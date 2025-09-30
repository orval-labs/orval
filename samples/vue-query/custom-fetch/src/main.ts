import { createApp } from 'vue';
import './style.css';

import { VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';

createApp(App).use(VueQueryPlugin).mount('#app');
