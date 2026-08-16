import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  PETSTORE_BASE_URL,
  providePetstoreBaseUrl,
  providePetstoreBaseUrlResolver,
  type PetstoreBaseUrlResolverContext,
} from '../api/base-url-token/petstore.base-url';
import { PetsService } from '../api/base-url-token/pets/pets.service';
import { showPetByIdResource } from '../api/base-url-token/pets/pets.resource';

// Exercises the opt-in `override.angular.baseUrl` DI token end to end (issue
// #3702): default resolution from the embedded spec server URL, the two
// provide-helper overrides, and that both consumption surfaces the feature
// targets — generated `HttpClient` service methods and standalone
// `httpResource` functions — read the exact same token value.
describe('base-url-token (override.angular.baseUrl)', () => {
  describe('default resolution', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection()],
      });
    });

    it('resolves to the normalized OpenAPI spec server URL', () => {
      const baseUrl = TestBed.inject(PETSTORE_BASE_URL);
      expect(baseUrl).toBe('http://petstore.swagger.io/v1');
    });
  });

  describe('providePetstoreBaseUrl', () => {
    it('overrides the token directly and normalizes a trailing slash', () => {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          providePetstoreBaseUrl('/api/petstore/'),
        ],
      });

      expect(TestBed.inject(PETSTORE_BASE_URL)).toBe('/api/petstore');
    });

    it('takes precedence over any configured resolver', () => {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          providePetstoreBaseUrlResolver(() => '/from-resolver'),
          providePetstoreBaseUrl('/from-direct-provider'),
        ],
      });

      expect(TestBed.inject(PETSTORE_BASE_URL)).toBe('/from-direct-provider');
    });
  });

  describe('providePetstoreBaseUrlResolver', () => {
    it('is invoked with the apiId and embedded server URL, and wins over the default', () => {
      let receivedContext: PetstoreBaseUrlResolverContext | undefined;

      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          providePetstoreBaseUrlResolver((context) => {
            receivedContext = context;
            return '/gateway/petstore';
          }),
        ],
      });

      expect(TestBed.inject(PETSTORE_BASE_URL)).toBe('/gateway/petstore');
      expect(receivedContext).toEqual({
        apiId: 'petstore',
        serverUrl: 'http://petstore.swagger.io/v1',
      });
    });
  });

  describe('shared token across HttpClient and httpResource surfaces', () => {
    let httpMock: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          provideHttpClient(),
          provideHttpClientTesting(),
          providePetstoreBaseUrl('/gateway/petstore'),
        ],
      });

      httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
      httpMock.verify();
    });

    it('prefixes the generated HttpClient service route with the provided base URL', () => {
      const service = TestBed.inject(PetsService);

      service.createPets({ name: 'Rex', tag: 'dog' }).subscribe();

      const req = httpMock.expectOne('/gateway/petstore/v1/pets');
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });

    it('prefixes an httpResource request created inside an injection context with the same base URL', () => {
      TestBed.runInInjectionContext(() => {
        showPetByIdResource(signal('1'), 'application/json');
      });
      TestBed.tick();

      const req = httpMock.expectOne('/gateway/petstore/v1/pets/1');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 1, name: 'Rex', requiredNullableString: null });
    });
  });
});
