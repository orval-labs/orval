import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

async function prepareApp() {
  if (isDevMode()) {
    const { worker } = await import('./orval/browser');
    return worker.start();
  }

  return Promise.resolve();
}

await prepareApp();
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
