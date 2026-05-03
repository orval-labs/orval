import { Verbs } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  getMutationInvalidatesConflictWarning,
  getQueryKeyVerbPrefix,
} from './query-generator';

const ruleFor = (op: string) => ({
  onMutations: [op],
  invalidates: ['listPets'],
});

describe('getMutationInvalidatesConflictWarning', () => {
  it('returns undefined when mutationInvalidates is missing', () => {
    expect(
      getMutationInvalidatesConflictWarning({
        operationName: 'createPets',
        isMutation: false,
        isQuery: true,
        mutationInvalidates: undefined,
      }),
    ).toBeUndefined();
  });

  it('returns undefined when mutationInvalidates is empty', () => {
    expect(
      getMutationInvalidatesConflictWarning({
        operationName: 'createPets',
        isMutation: false,
        isQuery: true,
        mutationInvalidates: [],
      }),
    ).toBeUndefined();
  });

  it('returns undefined when the operation is generated as a Mutation', () => {
    expect(
      getMutationInvalidatesConflictWarning({
        operationName: 'createPets',
        isMutation: true,
        isQuery: false,
        mutationInvalidates: [ruleFor('createPets')],
      }),
    ).toBeUndefined();
  });

  it('returns undefined when no rule references the operation', () => {
    expect(
      getMutationInvalidatesConflictWarning({
        operationName: 'createPets',
        isMutation: false,
        isQuery: true,
        mutationInvalidates: [ruleFor('deletePetById')],
      }),
    ).toBeUndefined();
  });

  it('warns and identifies the operation as a Query when isQuery is true', () => {
    const message = getMutationInvalidatesConflictWarning({
      operationName: 'createPets',
      isMutation: false,
      isQuery: true,
      mutationInvalidates: [ruleFor('createPets')],
    });

    expect(message).toBeDefined();
    expect(message).toContain("'createPets'");
    expect(message).toContain('Query hook');
    expect(message).toContain('not a Mutation');
    expect(message).toContain('onMutations');
  });

  it('warns and identifies the operation as no hook when neither flag is true', () => {
    const message = getMutationInvalidatesConflictWarning({
      operationName: 'createPets',
      isMutation: false,
      isQuery: false,
      mutationInvalidates: [ruleFor('createPets')],
    });

    expect(message).toBeDefined();
    expect(message).toContain("'createPets'");
    expect(message).toContain('plain function');
  });

  it('treats `undefined` isMutation as "not a Mutation"', () => {
    expect(
      getMutationInvalidatesConflictWarning({
        operationName: 'createPets',
        isMutation: undefined,
        isQuery: true,
        mutationInvalidates: [ruleFor('createPets')],
      }),
    ).toBeDefined();
  });

  it('finds the conflict even when the matching rule is not the first', () => {
    const message = getMutationInvalidatesConflictWarning({
      operationName: 'createPets',
      isMutation: false,
      isQuery: true,
      mutationInvalidates: [ruleFor('deletePetById'), ruleFor('createPets')],
    });

    expect(message).toBeDefined();
    expect(message).toContain("'createPets'");
  });
});

describe('getQueryKeyVerbPrefix', () => {
  it('returns undefined for GET so existing GET keys remain unchanged', () => {
    expect(
      getQueryKeyVerbPrefix({
        verb: Verbs.GET,
        useOperationIdAsQueryKey: false,
      }),
    ).toBeUndefined();
  });

  it('returns the uppercased verb for non-GET verbs to disambiguate cache keys', () => {
    expect(
      getQueryKeyVerbPrefix({
        verb: Verbs.POST,
        useOperationIdAsQueryKey: false,
      }),
    ).toBe('POST');
    expect(
      getQueryKeyVerbPrefix({
        verb: Verbs.PUT,
        useOperationIdAsQueryKey: false,
      }),
    ).toBe('PUT');
    expect(
      getQueryKeyVerbPrefix({
        verb: Verbs.PATCH,
        useOperationIdAsQueryKey: false,
      }),
    ).toBe('PATCH');
    expect(
      getQueryKeyVerbPrefix({
        verb: Verbs.DELETE,
        useOperationIdAsQueryKey: false,
      }),
    ).toBe('DELETE');
  });

  it('returns undefined when useOperationIdAsQueryKey is true (operation IDs are already verb+path unique)', () => {
    expect(
      getQueryKeyVerbPrefix({
        verb: Verbs.POST,
        useOperationIdAsQueryKey: true,
      }),
    ).toBeUndefined();
  });

  it('treats undefined useOperationIdAsQueryKey as falsy', () => {
    expect(
      getQueryKeyVerbPrefix({
        verb: Verbs.POST,
        useOperationIdAsQueryKey: undefined,
      }),
    ).toBe('POST');
  });
});
