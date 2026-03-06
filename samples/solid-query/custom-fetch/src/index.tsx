/* @refresh reload */
import { render } from 'solid-js/web';
import App from './App';
import './index.css';

const root = document.getElementById('root');

async function startApp() {
  if (import.meta.env.DEV) {
    const { initMocks } = await import('./mocks');
    await initMocks();
  }

  render(() => <App />, root!);
}

startApp();
