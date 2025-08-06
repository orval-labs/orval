import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
  provideAppInitializer,
} from '@angular/core';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';
import {
  ApiHttpService,
  setApiHttpService,
} from '../api/mutator/custom-instance';

// Initialize the API service for use in generated code
function initializeApiService() {
  return () => {
    const apiService = inject(ApiHttpService);
    setApiHttpService(apiService);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideTanStackQuery(new QueryClient()),
    provideAppInitializer(initializeApiService()),
  ],
};
