import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient } from '@angular/common/http';
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
  getDeletePetMutationOptions,
  getUpdatePetMutationOptions,
  getPatchPetMutationOptions,
  getListPetsQueryKey,
  getShowPetByIdQueryKey,
} from '../api/endpoints/pets/pets';

describe('mutationInvalidates feature', () => {
  let queryClient: QueryClient;
  let httpCtrl: HttpTestingController;
  let http: HttpClient;

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
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    queryClient.clear();
    httpCtrl.verify();
  });

  describe('getCreatePetsMutationOptions', () => {
    it('should include onSuccess callback that invalidates listPets query', () => {
      const options = TestBed.runInInjectionContext(() =>
        getCreatePetsMutationOptions(http, queryClient),
      );

      expect(options.onSuccess).toBeDefined();
      expect(typeof options.onSuccess).toBe('function');
    });

    it('should have mutationFn defined', () => {
      const options = TestBed.runInInjectionContext(() =>
        getCreatePetsMutationOptions(http, queryClient),
      );

      expect(options.mutationFn).toBeDefined();
      expect(typeof options.mutationFn).toBe('function');
    });

    it('should invalidate listPets query when onSuccess is called', () => {
      const queryKey = getListPetsQueryKey();
      queryClient.setQueryData(queryKey, [{ id: 1, name: 'Existing Pet' }]);

      const options = TestBed.runInInjectionContext(() =>
        getCreatePetsMutationOptions(http, queryClient),
      );

      options.onSuccess!(
        undefined,
        { data: { name: 'New Pet', tag: 'dog' } },
        undefined as never,
        undefined as never,
      );

      const queryState = queryClient.getQueryState(queryKey);
      expect(queryState?.isInvalidated).toBe(true);
    });
  });

  describe('getDeletePetMutationOptions', () => {
    it('should include onSuccess callback', () => {
      const options = TestBed.runInInjectionContext(() =>
        getDeletePetMutationOptions(http, queryClient),
      );

      expect(options.onSuccess).toBeDefined();
      expect(typeof options.onSuccess).toBe('function');
    });

    it('should invalidate both listPets and showPetById queries when onSuccess is called', () => {
      const listPetsKey = getListPetsQueryKey();
      const showPetByIdKey = getShowPetByIdQueryKey('123');

      queryClient.setQueryData(listPetsKey, [
        { id: 123, name: 'Pet to delete' },
      ]);
      queryClient.setQueryData(showPetByIdKey, {
        id: 123,
        name: 'Pet to delete',
      });

      const options = TestBed.runInInjectionContext(() =>
        getDeletePetMutationOptions(http, queryClient),
      );

      options.onSuccess!(
        undefined,
        { petId: '123' },
        undefined as never,
        undefined as never,
      );

      expect(queryClient.getQueryState(listPetsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(showPetByIdKey)?.isInvalidated).toBe(
        true,
      );
    });

    it('should call user-provided onSuccess callback with correct arguments', () => {
      let userCallbackCalled = false;
      let receivedVariables: unknown;

      const options = TestBed.runInInjectionContext(() =>
        getDeletePetMutationOptions(http, queryClient, {
          mutation: {
            onSuccess: (
              _data: void,
              variables: { petId: string },
              _onMutateResult: unknown,
              _context: unknown,
            ) => {
              userCallbackCalled = true;
              receivedVariables = variables;
            },
          },
        }),
      );

      options.onSuccess!(
        undefined,
        { petId: '456' },
        undefined as never,
        undefined as never,
      );

      expect(userCallbackCalled).toBe(true);
      expect(receivedVariables).toEqual({ petId: '456' });
    });
  });

  describe('getUpdatePetMutationOptions', () => {
    it('should include onSuccess callback', () => {
      const options = TestBed.runInInjectionContext(() =>
        getUpdatePetMutationOptions(http, queryClient),
      );

      expect(options.onSuccess).toBeDefined();
      expect(typeof options.onSuccess).toBe('function');
    });

    it('should invalidate both listPets and showPetById queries when onSuccess is called', () => {
      const listPetsKey = getListPetsQueryKey();
      const showPetByIdKey = getShowPetByIdQueryKey('789');

      queryClient.setQueryData(listPetsKey, [
        { id: 789, name: 'Pet to update' },
      ]);
      queryClient.setQueryData(showPetByIdKey, {
        id: 789,
        name: 'Pet to update',
      });

      const options = TestBed.runInInjectionContext(() =>
        getUpdatePetMutationOptions(http, queryClient),
      );

      options.onSuccess!(
        { id: 789, name: 'Updated Pet', requiredNullableString: null },
        {
          petId: '789',
          data: { id: 789, name: 'Updated Pet', requiredNullableString: null },
        },
        undefined as never,
        undefined as never,
      );

      expect(queryClient.getQueryState(listPetsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(showPetByIdKey)?.isInvalidated).toBe(
        true,
      );
    });
  });

  describe('getPatchPetMutationOptions', () => {
    it('should include onSuccess callback', () => {
      const options = TestBed.runInInjectionContext(() =>
        getPatchPetMutationOptions(http, queryClient),
      );

      expect(options.onSuccess).toBeDefined();
      expect(typeof options.onSuccess).toBe('function');
    });

    it('should invalidate both listPets and showPetById queries when onSuccess is called', () => {
      const listPetsKey = getListPetsQueryKey();
      const showPetByIdKey = getShowPetByIdQueryKey('999');

      queryClient.setQueryData(listPetsKey, [
        { id: 999, name: 'Pet to patch' },
      ]);
      queryClient.setQueryData(showPetByIdKey, {
        id: 999,
        name: 'Pet to patch',
      });

      const options = TestBed.runInInjectionContext(() =>
        getPatchPetMutationOptions(http, queryClient),
      );

      options.onSuccess!(
        {
          id: 999,
          name: 'Pet to patch',
          tag: 'patched',
          requiredNullableString: null,
        },
        { petId: '999', data: { tag: 'patched' } },
        undefined as never,
        undefined as never,
      );

      expect(queryClient.getQueryState(listPetsKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(showPetByIdKey)?.isInvalidated).toBe(
        true,
      );
    });
  });

  describe('query invalidation with params', () => {
    it('should invalidate only the specific pet query matching the petId variable', () => {
      const showPetById123 = getShowPetByIdQueryKey('123');
      const showPetById456 = getShowPetByIdQueryKey('456');

      queryClient.setQueryData(showPetById123, { id: 123, name: 'Pet 123' });
      queryClient.setQueryData(showPetById456, { id: 456, name: 'Pet 456' });

      const options = TestBed.runInInjectionContext(() =>
        getDeletePetMutationOptions(http, queryClient),
      );

      options.onSuccess!(
        undefined,
        { petId: '123' },
        undefined as never,
        undefined as never,
      );

      expect(queryClient.getQueryState(showPetById123)?.isInvalidated).toBe(
        true,
      );
      expect(queryClient.getQueryState(showPetById456)?.isInvalidated).toBe(
        false,
      );
    });
  });

  describe('user callback chaining', () => {
    it('should call user-provided onSuccess callback with correct arguments', () => {
      let userCallbackCalled = false;
      let receivedData: unknown;
      let receivedVariables: unknown;

      const options = TestBed.runInInjectionContext(() =>
        getCreatePetsMutationOptions(http, queryClient, {
          mutation: {
            onSuccess: (
              data: void,
              variables: { data: { name: string; tag: string } },
              _onMutateResult: unknown,
              _context: unknown,
            ) => {
              userCallbackCalled = true;
              receivedData = data;
              receivedVariables = variables;
            },
          },
        }),
      );

      const mockVariables = { data: { name: 'Test Pet', tag: 'cat' } };

      options.onSuccess!(
        undefined,
        mockVariables,
        undefined as never,
        undefined as never,
      );

      expect(userCallbackCalled).toBe(true);
      expect(receivedData).toBe(undefined);
      expect(receivedVariables).toEqual(mockVariables);
    });

    it('should run both invalidation and user onSuccess callback (composition)', () => {
      const listPetsKey = getListPetsQueryKey();
      queryClient.setQueryData(listPetsKey, [{ id: 1, name: 'Existing' }]);

      let userCallbackCalled = false;

      const options = TestBed.runInInjectionContext(() =>
        getDeletePetMutationOptions(http, queryClient, {
          mutation: {
            onSuccess: () => {
              userCallbackCalled = true;
            },
          },
        }),
      );

      const mockContext: MutationFunctionContext = {
        client: queryClient,
        meta: undefined,
      };

      options.onSuccess!(
        undefined,
        { petId: '1' },
        undefined as never,
        mockContext,
      );

      expect(queryClient.getQueryState(listPetsKey)?.isInvalidated).toBe(true);
      expect(userCallbackCalled).toBe(true);
    });

    it('should skip invalidation when skipInvalidation is true', () => {
      const listPetsKey = getListPetsQueryKey();
      queryClient.setQueryData(listPetsKey, [{ id: 1, name: 'Existing' }]);

      let userCallbackCalled = false;

      const options = TestBed.runInInjectionContext(() =>
        getDeletePetMutationOptions(http, queryClient, {
          mutation: {
            onSuccess: () => {
              userCallbackCalled = true;
            },
          },
          skipInvalidation: true,
        }),
      );

      const mockContext: MutationFunctionContext = {
        client: queryClient,
        meta: undefined,
      };

      options.onSuccess!(
        undefined,
        { petId: '1' },
        undefined as never,
        mockContext,
      );

      expect(queryClient.getQueryState(listPetsKey)?.isInvalidated).toBe(false);
      expect(userCallbackCalled).toBe(true);
    });
  });
});
