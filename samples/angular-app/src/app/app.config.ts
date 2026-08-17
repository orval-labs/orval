import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePetstoreBaseUrl } from '../api/base-url-token/petstore.base-url';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideRouter(routes),
    // Redirects the `base-url-token` generated client (see BaseUrlTokenPage).
    // Its embedded default is the absolute, cross-origin
    // `http://petstore.swagger.io/v1` taken from the spec's `servers` field;
    // this points it at a same-origin gateway path the demo's MSW handlers
    // serve. Root is the correct place for this: the generated services are
    // `providedIn: 'root'`, so a component-level provider would not reach them.
    providePetstoreBaseUrl('/gateway/petstore'),
  ],
};
