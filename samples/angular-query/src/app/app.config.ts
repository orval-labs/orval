import { provideHttpClient } from '@angular/common/http';
import type {
  ApplicationConfig} from '@angular/core';
import {
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideTanStackQuery(() => new QueryClient()),
  ],
};
