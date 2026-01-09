import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  provideTanStackQuery,
  QueryClient,
} from '@tanstack/angular-query-experimental';

import {
  getCreatePetsMutationOptions,
  getListPetsQueryKey,
} from '../api/endpoints/pets/pets';
import type { MutationFunctionContext } from '@tanstack/angular-query-experimental';

describe('mutationInvalidates feature', () => {
  let queryClient: QueryClient;
  let httpCtrl: HttpTestingController;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
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

  describe('getCreatePetsMutationOptions', () => {
    it('should include onSuccess callback that invalidates listPets query', () => {
      const options = TestBed.runInInjectionContext(() =>
        getCreatePetsMutationOptions(),
      );

      expect(options.onSuccess).toBeDefined();
      expect(typeof options.onSuccess).toBe('function');
    });

    it('should have mutationFn defined', () => {
      const options = TestBed.runInInjectionContext(() =>
        getCreatePetsMutationOptions(),
      );

      expect(options.mutationFn).toBeDefined();
      expect(typeof options.mutationFn).toBe('function');
    });
  });

  describe('query invalidation behavior', () => {
    it('should invalidate listPets query when onSuccess is called', () => {
      const queryKey = getListPetsQueryKey();
      queryClient.setQueryData(queryKey, [{ id: 1, name: 'Existing Pet' }]);

      const options = TestBed.runInInjectionContext(() =>
        getCreatePetsMutationOptions(),
      );

      const mockContext: MutationFunctionContext = {
        client: queryClient,
        meta: undefined,
      };

      options.onSuccess!(
        undefined,
        { data: { name: 'New Pet', tag: 'dog' } },
        undefined as never,
        mockContext,
      );

      const queryState = queryClient.getQueryState(queryKey);
      expect(queryState?.isInvalidated).toBe(true);
    });

    it('should call user-provided onSuccess callback with correct arguments', () => {
      let userCallbackCalled = false;
      let receivedData: unknown;
      let receivedVariables: unknown;

      const options = TestBed.runInInjectionContext(() =>
        getCreatePetsMutationOptions({
          mutation: {
            onSuccess: (data, variables, _onMutateResult, _context) => {
              userCallbackCalled = true;
              receivedData = data;
              receivedVariables = variables;
            },
          },
        }),
      );

      const mockContext: MutationFunctionContext = {
        client: queryClient,
        meta: undefined,
      };

      const mockVariables = { data: { name: 'Test Pet', tag: 'cat' } };

      options.onSuccess!(
        undefined,
        mockVariables,
        undefined as never,
        mockContext,
      );

      expect(userCallbackCalled).toBe(true);
      expect(receivedData).toBe(undefined);
      expect(receivedVariables).toEqual(mockVariables);
    });
  });
});
