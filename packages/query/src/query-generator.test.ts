import type { GeneratorMutator, GetterBody } from '@orval/core';
import { Verbs } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  allowUndefinedParam,
  getMutationInvalidatesConflictWarning,
  getQueryKeyVerbPrefix,
  makeOptionalParam,
  wrapPropsBodyWithMutatorBodyType,
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
    expect(
      getQueryKeyVerbPrefix({
        verb: Verbs.HEAD,
        useOperationIdAsQueryKey: false,
      }),
    ).toBe('HEAD');
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

describe('wrapPropsBodyWithMutatorBodyType', () => {
  const mutatorWithBodyType = {
    bodyTypeName: 'BodyType',
  } as unknown as GeneratorMutator;
  const bodyOf = (definition: string): GetterBody =>
    ({ definition }) as unknown as GetterBody;

  it('returns propsString unchanged when mutator is undefined', () => {
    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString: 'createPetsBody: CreatePetsBody',
        body: bodyOf('CreatePetsBody'),
        mutator: undefined,
      }),
    ).toBe('createPetsBody: CreatePetsBody');
  });

  it('returns propsString unchanged when mutator has no bodyTypeName', () => {
    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString: 'createPetsBody: CreatePetsBody',
        body: bodyOf('CreatePetsBody'),
        mutator: {} as unknown as GeneratorMutator,
      }),
    ).toBe('createPetsBody: CreatePetsBody');
  });

  it('returns propsString unchanged when body has no definition', () => {
    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString: 'foo: number',
        body: bodyOf(''),
        mutator: mutatorWithBodyType,
      }),
    ).toBe('foo: number');
  });

  it('wraps a required body parameter', () => {
    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString: 'createPetsBody: CreatePetsBody, params: P',
        body: bodyOf('CreatePetsBody'),
        mutator: mutatorWithBodyType,
      }),
    ).toBe('createPetsBody: BodyType<CreatePetsBody>, params: P');
  });

  it('wraps an optional body parameter while preserving the `?`', () => {
    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString: 'createPetsBody?: CreatePetsBody, params?: P',
        body: bodyOf('CreatePetsBody'),
        mutator: mutatorWithBodyType,
      }),
    ).toBe('createPetsBody?: BodyType<CreatePetsBody>, params?: P');
  });

  it('wraps a `undefined | T` body parameter (the definedInitialData transform)', () => {
    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString:
          'createPetsBody: undefined | CreatePetsBody, params: undefined | P',
        body: bodyOf('CreatePetsBody'),
        mutator: mutatorWithBodyType,
      }),
    ).toBe(
      'createPetsBody: undefined | BodyType<CreatePetsBody>, params: undefined | P',
    );
  });

  it('escapes regex metacharacters in body.definition (e.g. arrays, unions)', () => {
    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString: 'pets: Pet[]',
        body: bodyOf('Pet[]'),
        mutator: mutatorWithBodyType,
      }),
    ).toBe('pets: BodyType<Pet[]>');

    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString: 'animal: Pet | Cat',
        body: bodyOf('Pet | Cat'),
        mutator: mutatorWithBodyType,
      }),
    ).toBe('animal: BodyType<Pet | Cat>');
  });

  it('only wraps the body prop, not other props with similar shapes', () => {
    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString: 'params: SomethingElse, createPetsBody: CreatePetsBody',
        body: bodyOf('CreatePetsBody'),
        mutator: mutatorWithBodyType,
      }),
    ).toBe('params: SomethingElse, createPetsBody: BodyType<CreatePetsBody>');
  });
});

describe('makeOptionalParam', () => {
  it('rewrites a required name to optional', () => {
    expect(makeOptionalParam('params: ListPetsParams')).toBe(
      'params?: ListPetsParams',
    );
  });

  it('leaves params with a default value untouched', () => {
    expect(makeOptionalParam('params: ListPetsParams = {}')).toBe(
      'params: ListPetsParams = {}',
    );
  });

  it('passes through generics with `<...>` payload', () => {
    expect(makeOptionalParam('params: MaybeRef<ListPetsParams>')).toBe(
      'params?: MaybeRef<ListPetsParams>',
    );
  });

  // Pin: destructured params without a default fall through unchanged (the
  // leading `\w+` anchor fails to match). Toolchain only emits destructured
  // params *with* defaults today, but pin the behaviour so a future regex
  // tweak cannot silently change it.
  it('leaves destructured params without a default unchanged', () => {
    expect(makeOptionalParam('{ a }: T')).toBe('{ a }: T');
  });

  it('returns empty input unchanged', () => {
    expect(makeOptionalParam('')).toBe('');
  });
});

describe('allowUndefinedParam', () => {
  it('widens required `name: T` to `name: T | undefined`', () => {
    expect(allowUndefinedParam('params: ListPetsParams')).toBe(
      'params: ListPetsParams | undefined',
    );
  });

  it('normalises optional `name?: T` to required `name: T | undefined`', () => {
    expect(allowUndefinedParam('params?: ListPetsParams')).toBe(
      'params: ListPetsParams | undefined',
    );
  });

  it('leaves params with a default value untouched', () => {
    expect(
      allowUndefinedParam('{ version = 1 }: ListPetsPathParameters = {}'),
    ).toBe('{ version = 1 }: ListPetsPathParameters = {}');
  });

  it('preserves generic payload', () => {
    expect(allowUndefinedParam('params: MaybeRef<ListPetsParams>')).toBe(
      'params: MaybeRef<ListPetsParams> | undefined',
    );
  });

  it('leaves destructured params without a default unchanged', () => {
    expect(allowUndefinedParam('{ a }: T')).toBe('{ a }: T');
  });

  it('returns empty input unchanged', () => {
    expect(allowUndefinedParam('')).toBe('');
  });

  // Regression for the pipeline that drives `set*QueryData` props: an
  // optional body prop is widened to `body: T | undefined`, then
  // `wrapPropsBodyWithMutatorBodyType` must still wrap the body type as
  // `BodyType<T>`. If the union order ever swaps to `undefined | T`, the
  // wrap regex would still match — but verify the happy path explicitly so
  // future regex tweaks cannot break body wrapping silently.
  it('composes with wrapPropsBodyWithMutatorBodyType for optional body params', () => {
    const widened = allowUndefinedParam('createPetsBody?: CreatePetsBody');
    expect(widened).toBe('createPetsBody: CreatePetsBody | undefined');
    expect(
      wrapPropsBodyWithMutatorBodyType({
        propsString: widened,
        body: { definition: 'CreatePetsBody' } as unknown as GetterBody,
        mutator: { bodyTypeName: 'BodyType' } as unknown as GeneratorMutator,
      }),
    ).toBe('createPetsBody: BodyType<CreatePetsBody> | undefined');
  });
});
