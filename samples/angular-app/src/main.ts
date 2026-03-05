import { isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppShell } from './app/app.shell';

async function prepareApp() {
  if (isDevMode()) {
    const { worker } = await import('./orval/browser');
    return worker.start();
  }

  return Promise.resolve();
}

await prepareApp();
bootstrapApplication(AppShell, appConfig).catch((err) => console.error(err));
