import { expect, test, vi } from 'vite-plus/test';

import {
  getCreatePetsMutationOptions,
  getDeletePetByIdMutationOptions,
  getListPetsQueryKey,
} from './generated/react-query/invalidates-mutation-options-mutator/endpoints';

// Regression tests for https://github.com/orval-labs/orval/issues/4165
//
// `mutationInvalidates` emits its invalidation as a generated `onSuccess`.
// When a `mutationOptions` mutator is configured, whatever the mutator returns
// is what the whole factory returns — so the handler has to be passed into the
// mutator call. orval used to build it and then leave it out, and the
// configured invalidation silently never ran.

const queryClientStub = () => {
  const invalidateQueries = vi.fn();
  return { queryClient: { invalidateQueries }, invalidateQueries };
};

// TanStack gained a 4th `MutationFunctionContext` argument during v5, and the
// generated handler follows whichever shape the installed version has. Calling
// through an untyped signature keeps this spec pinned to the behaviour rather
// than to the arity; a surplus argument is inert at runtime.
const fire = (onSuccess: unknown, queryClient: unknown) =>
  (onSuccess as (...args: unknown[]) => void)(undefined, undefined, undefined, {
    client: queryClient,
  });

test('the invalidation handler reaches the mutator and invalidates', () => {
  const { queryClient, invalidateQueries } = queryClientStub();

  const options = getCreatePetsMutationOptions(queryClient as never);

  expect(options.onSuccess).toBeDefined();
  fire(options.onSuccess, queryClient);

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getListPetsQueryKey(),
  });
});

test("the caller's own onSuccess still runs after the invalidation", () => {
  const { queryClient, invalidateQueries } = queryClientStub();
  const callerOnSuccess = vi.fn();

  const options = getCreatePetsMutationOptions(queryClient as never, {
    mutation: { onSuccess: callerOnSuccess },
  });

  fire(options.onSuccess, queryClient);

  expect(invalidateQueries).toHaveBeenCalledOnce();
  expect(callerOnSuccess).toHaveBeenCalledOnce();
});

test('skipInvalidation still suppresses the invalidation through the mutator', () => {
  const { queryClient, invalidateQueries } = queryClientStub();

  const options = getCreatePetsMutationOptions(queryClient as never, {
    skipInvalidation: true,
  });

  fire(options.onSuccess, queryClient);

  expect(invalidateQueries).not.toHaveBeenCalled();
});

test('an operation with no rule keeps the caller onSuccess untouched', () => {
  const callerOnSuccess = vi.fn();

  const options = getDeletePetByIdMutationOptions({
    mutation: { onSuccess: callerOnSuccess },
  });

  expect(options.onSuccess).toBe(callerOnSuccess);
});
