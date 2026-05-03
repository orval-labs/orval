import { describe, expect, it } from 'vitest';

import { getMutationInvalidatesConflictWarning } from './query-generator';

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
