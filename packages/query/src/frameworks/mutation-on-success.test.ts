import { describe, expect, it } from 'vite-plus/test';

import type { PackageJson } from '@orval/core';

import { createFrameworkAdapter } from '.';

/**
 * TanStack Query moved the `onSuccess` mutation context parameter twice:
 *
 * - 5.89.0 renamed `context: TContext` to
 *   `onMutateResult: TOnMutateResult | undefined`.
 * - 5.90.2 narrowed it back to `onMutateResult: TOnMutateResult`.
 *
 * Emitting the narrow parameter for 5.89.0/5.90.1 makes the generated handler
 * unassignable to `onSuccess` (TS2322); emitting the wide one for 5.90.2+
 * makes it unable to forward `onMutateResult` to the caller's own handler
 * (TS2345). Every `mutationInvalidates` output hits one or the other.
 * See issue #4180.
 */
const packageJsonFor = (client: string, version: string): PackageJson => ({
  dependencies: {
    [client === 'angular-query'
      ? '@tanstack/angular-query-experimental'
      : `@tanstack/${client}`]: version,
  },
});

/** Solid emits no generated `onSuccess`, so it has nothing to widen. */
const CLIENTS = [
  'react-query',
  'vue-query',
  'svelte-query',
  'angular-query',
] as const;

const onSuccessContext = {
  operationName: 'createPets',
  definitions: '',
  mutationVariablesType: 'CreatePetsMutationVariables',
  generateInvalidateCalls: () =>
    'queryClient.invalidateQueries({ queryKey: getListPetsQueryKey() });',
  uniqueInvalidates: [],
};

const onSuccessFor = (
  client: (typeof CLIENTS)[number],
  version: string,
  isRequestOptions: boolean,
) =>
  createFrameworkAdapter({
    outputClient: client,
    packageJson: packageJsonFor(client, version),
  }).generateMutationOnSuccess({ ...onSuccessContext, isRequestOptions });

describe('generateMutationOnSuccess onMutateResult nullability (issue #4180)', () => {
  for (const client of CLIENTS) {
    for (const isRequestOptions of [true, false]) {
      const suffix = isRequestOptions ? ' with request options' : '';

      it(`${client} widens onMutateResult inside the window${suffix}`, () => {
        expect(onSuccessFor(client, '5.89.0', isRequestOptions)).toContain(
          'onMutateResult: TContext | undefined',
        );
      });

      it(`${client} keeps onMutateResult required after it${suffix}`, () => {
        const onSuccess = onSuccessFor(client, '5.90.2', isRequestOptions);

        expect(onSuccess).toContain('onMutateResult: TContext,');
        expect(onSuccess).not.toContain('onMutateResult: TContext |');
      });
    }
  }

  it('keeps the pre-rename context parameter before 5.89.0', () => {
    const onSuccess = onSuccessFor('react-query', '5.62.16', true);

    expect(onSuccess).not.toContain('onMutateResult');
    expect(onSuccess).toContain('context: TContext)');
  });
});
