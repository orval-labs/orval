/**
 * Tests for mutationInvalidates feature
 *
 * This test verifies that mutations with `mutationInvalidates` configuration
 * correctly invalidate the specified queries when the mutation succeeds.
 *
 * Following TanStack Angular Query testing patterns:
 * https://tanstack.com/query/latest/docs/framework/angular/guides/testing
 */
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
    // Create a fresh QueryClient for each test with retry disabled for faster tests
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

      // Verify the mutation options include an onSuccess callback
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
      // Set up an initial query cache entry
      const queryKey = getListPetsQueryKey();
      queryClient.setQueryData(queryKey, [{ id: 1, name: 'Existing Pet' }]);

      // Get mutation options
      const options = TestBed.runInInjectionContext(() =>
        getCreatePetsMutationOptions(),
      );

      // Create a mock MutationFunctionContext
      const mockContext: MutationFunctionContext = {
        client: queryClient,
        meta: undefined,
      };

      // Call onSuccess synchronously (no race condition - this is testing the callback directly)
      options.onSuccess!(
        undefined, // data (createPets returns void)
        { data: { name: 'New Pet', tag: 'dog' } }, // variables
        undefined as never, // onMutateResult
        mockContext, // context
      );

      // After invalidation, the query should be marked as stale
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

      // Call the generated onSuccess
      options.onSuccess!(
        undefined,
        mockVariables,
        undefined as never,
        mockContext,
      );

      // User's onSuccess should have been called with the same arguments
      expect(userCallbackCalled).toBe(true);
      expect(receivedData).toBe(undefined);
      expect(receivedVariables).toEqual(mockVariables);
    });
  });
});
