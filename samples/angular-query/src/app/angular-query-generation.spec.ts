import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';

import {
  listPets,
  getListPetsQueryOptions,
  injectListPets,
  getListPetsQueryKey,
} from '../api/endpoints-no-transformer/pets/pets';

import {
  listPets as listPetsCustom,
  getListPetsQueryOptions as getListPetsQueryOptionsCustom,
  injectListPets as injectListPetsCustom,
  getListPetsQueryKey as getListPetsQueryKeyCustom,
  ListPetsQueryError,
} from '../api/endpoints-custom-instance/pets/pets';

describe('Angular Query Generation - No Transformer (Native HttpClient)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideTanStackQuery(queryClient),
      ],
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should export listPets function', () => {
    expect(listPets).toBeDefined();
    expect(typeof listPets).toBe('function');
  });

  it('should export getListPetsQueryOptions function', () => {
    expect(getListPetsQueryOptions).toBeDefined();
    expect(typeof getListPetsQueryOptions).toBe('function');
  });

  it('should export injectListPets function', () => {
    expect(injectListPets).toBeDefined();
    expect(typeof injectListPets).toBe('function');
  });

  it('getListPetsQueryOptions should return options with queryKey and queryFn', () => {
    const options = TestBed.runInInjectionContext(() =>
      getListPetsQueryOptions({ limit: '10' }),
    );

    expect(options.queryKey).toBeDefined();
    expect(options.queryFn).toBeDefined();
    expect(typeof options.queryFn).toBe('function');
  });
});

describe('Angular Query Generation - Custom Instance (Custom Mutator)', () => {
  let queryClient: QueryClient;
  let httpCtrl: HttpTestingController;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTanStackQuery(queryClient),
      ],
    });

    httpCtrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    queryClient.clear();
    httpCtrl.verify();
  });

  it('should export listPets function with custom mutator', () => {
    expect(listPetsCustom).toBeDefined();
    expect(typeof listPetsCustom).toBe('function');
  });

  it('should export getListPetsQueryOptions function with custom mutator', () => {
    expect(getListPetsQueryOptionsCustom).toBeDefined();
    expect(typeof getListPetsQueryOptionsCustom).toBe('function');
  });

  it('should export injectListPets function with custom mutator', () => {
    expect(injectListPetsCustom).toBeDefined();
    expect(typeof injectListPetsCustom).toBe('function');
  });

  it('ErrorType should be compatible with HttpErrorResponse structure', () => {
    const mockError: ListPetsQueryError = {
      name: 'HttpErrorResponse',
      message: 'Http failure response',
      error: { code: 404, message: 'Not found' },
      ok: false,
      status: 404,
      statusText: 'Not Found',
      url: '/pets',
      headers: {} as any,
      type: 0 as any,
    };

    expect(mockError.status).toBe(404);
    expect(mockError.error).toEqual({ code: 404, message: 'Not found' });
    expect(mockError.ok).toBe(false);
  });

  it('getListPetsQueryOptions should return options with queryKey and queryFn', () => {
    const options = TestBed.runInInjectionContext(() =>
      getListPetsQueryOptionsCustom({ limit: '10' }),
    );

    expect(options.queryKey).toBeDefined();
    expect(options.queryFn).toBeDefined();
    expect(typeof options.queryFn).toBe('function');
  });

  it('listPetsCustom should accept params and signal and return a Promise', async () => {
    const abortController = new AbortController();
    const resultPromise = TestBed.runInInjectionContext(() =>
      listPetsCustom({ limit: '10' }, abortController.signal),
    );

    expect(resultPromise).toBeInstanceOf(Promise);

    const mockPets = [{ id: 1, name: 'Fluffy' }];
    const req = httpCtrl.expectOne('/pets?limit=10');
    expect(req.request.method).toBe('GET');
    req.flush(mockPets);

    const result = await resultPromise;
    expect(result).toEqual(mockPets);
  });

  it('queryFn should accept signal and call listPets with it', async () => {
    const options = TestBed.runInInjectionContext(() =>
      getListPetsQueryOptionsCustom({ limit: '5' }),
    );

    const abortController = new AbortController();
    const mockQueryFnContext = {
      signal: abortController.signal,
      queryKey: options.queryKey,
      meta: undefined,
    };

    expect(options.queryFn).toBeDefined();
    expect(typeof options.queryFn).toBe('function');

    const queryFn = options.queryFn as Function;
    const resultPromise = TestBed.runInInjectionContext(() =>
      queryFn(mockQueryFnContext),
    );

    expect(resultPromise).toBeInstanceOf(Promise);

    const mockPets = [{ id: 2, name: 'Buddy' }];
    const req = httpCtrl.expectOne('/pets?limit=5');
    expect(req.request.method).toBe('GET');
    req.flush(mockPets);

    const result = await resultPromise;
    expect(result).toEqual(mockPets);
  });

  it('queryKey shape should match native generation', () => {
    const params = { limit: '10' };
    const nativeKey = getListPetsQueryKey(params);
    const customKey = getListPetsQueryKeyCustom(params);

    expect(customKey).toEqual(nativeKey);
    expect(customKey[0]).toBe('/pets');
    expect(customKey[1]).toEqual(params);
  });

  it('queryKey without params should match native generation', () => {
    const nativeKey = getListPetsQueryKey();
    const customKey = getListPetsQueryKeyCustom();

    expect(customKey).toEqual(nativeKey);
    expect(customKey.length).toBe(1);
    expect(customKey[0]).toBe('/pets');
  });

  it('getListPetsQueryOptionsCustom should not require direct HttpClient injection in generated code', () => {
    const options = TestBed.runInInjectionContext(() =>
      getListPetsQueryOptionsCustom(),
    );

    expect(options.queryKey).toEqual(['/pets']);
    expect(options.queryFn).toBeDefined();
  });

  it('injectListPetsCustom should return a query result without direct HttpClient injection in generated code', () => {
    const query = TestBed.runInInjectionContext(() =>
      injectListPetsCustom({ limit: '10' }),
    );

    expect(query).toBeDefined();
    expect(query.status).toBeDefined();
  });
});
