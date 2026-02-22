import { describe, expect, it } from 'vitest';

import type { ContextSpec, GeneratorImport, ResolverValue } from '../types.ts';
import {
  getAliasedImports,
  getImportAliasForRefOrValue,
  needCreateImportAlias,
} from './imports.ts';

const baseContext: Omit<ContextSpec, 'output'> = {
  target: 'spec',
  workspace: '',
  spec: {},
};

const contextWithSchemas = {
  ...baseContext,
  output: {
    schemas: '/schemas',
  },
} as ContextSpec;

const contextWithoutSchemas = {
  ...baseContext,
  output: {
    schemas: undefined,
  },
} as ContextSpec;

const baseResolvedValue: ResolverValue = {
  isRef: false,
  imports: [],
  hasReadonlyProps: false,
  isEnum: false,
  originalSchema: {},
  schemas: [],
  type: 'object',
  value: '',
  dependencies: [],
};

describe('getAliasedImports getter', () => {
  it('should return resolvedValue imports when resolvedValue.isRef field is false', () => {
    const resolvedValue: ResolverValue = {
      ...baseResolvedValue,
      isRef: false,
      imports: [],
    };

    expect(
      getAliasedImports({
        context: contextWithSchemas,
        resolvedValue,
      }),
    ).toBe(resolvedValue.imports);
  });

  it('should return resolvedValue.imports field when context.output.schemas field is empty', () => {
    const resolvedValue: ResolverValue = {
      ...baseResolvedValue,
      isRef: true,
      imports: [],
    };

    expect(
      getAliasedImports({
        context: contextWithoutSchemas,
        resolvedValue,
      }),
    ).toBe(resolvedValue.imports);
  });

  describe('with non empty context.output.schemas field and truthy resolvedValue.isRef field', () => {
    const testCases: [
      Omit<Parameters<typeof getAliasedImports>[0], 'context'>,
      (string | undefined)[],
    ][] = [
      [
        {
          name: 'A',
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'A',
              },
            ],
          },
        },
        ['__A'],
      ],
      [
        {
          name: 'A',
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'B',
              },
            ],
          },
        },
        [undefined],
      ],
      [
        {
          name: undefined,
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'A',
              },
            ],
          },
        },
        [undefined],
      ],
      [
        {
          name: undefined,
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'A',
              },
            ],
          },
        },
        [undefined],
      ],
      [
        {
          name: undefined,
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'A',
              },
            ],
          },
        },
        [undefined],
      ],
    ];

    it.each(testCases)('aliases for %j should be %j', (input, aliases) => {
      const expected = aliases.map((alias, index) => ({
        ...input.resolvedValue.imports.at(index),
        ...(alias === undefined ? {} : { alias }),
      }));

      const result = getAliasedImports({
        ...input,
        context: contextWithSchemas,
      });

      expect(result).toStrictEqual(expected);
    });
  });
});

describe('needCreateImportAlias', () => {
  it('should return false when import has alias', () => {
    const imp: GeneratorImport = {
      alias: 'AliasForC',
      name: 'C',
    };

    expect(needCreateImportAlias({ imp })).toBeFalsy();
  });

  it('should return true when name eq import name and import has not alias', () => {
    const imp: GeneratorImport = { name: 'C' };

    expect(
      needCreateImportAlias({
        imp,
        name: 'C',
      }),
    ).toBeTruthy();
  });
});

describe('getImportAliasForRefOrValue getter', () => {
  it('should return resolvedValue.value when resolvedValue.isRef field is false', () => {
    const resolvedValue: ResolverValue = {
      ...baseResolvedValue,
      isRef: false,
      imports: [],
      value: 'A',
    };

    expect(
      getImportAliasForRefOrValue({
        context: contextWithSchemas,
        resolvedValue,
        imports: [
          {
            name: 'A',
            alias: 'AnoterSpec__A',
          },
        ],
      }),
    ).toBe(resolvedValue.value);
  });

  it('should return resolvedValue.value field when context.output.schemas field is empty', () => {
    const resolvedValue: ResolverValue = {
      ...baseResolvedValue,
      isRef: true,
      imports: [],
      value: 'A',
    };

    expect(
      getImportAliasForRefOrValue({
        context: contextWithoutSchemas,
        resolvedValue,
        imports: [
          {
            name: 'A',
            alias: 'AnoterSpec__A',
          },
        ],
      }),
    ).toBe(resolvedValue.value);
  });

  describe('with non empty context.output.schemas field and truthy resolvedValue.isRef field', () => {
    const testCases: [
      Omit<Parameters<typeof getImportAliasForRefOrValue>[0], 'context'>,
      string,
    ][] = [
      [
        {
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            value: 'A',
          },
          imports: [],
        },
        'A',
      ],
      [
        {
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            value: 'A',
          },
          imports: [
            {
              name: 'B',
              alias: 'AnoterSpec__B',
            },
          ],
        },
        'A',
      ],
      [
        {
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            value: 'A',
          },
          imports: [
            {
              name: 'A',
              alias: undefined,
            },
          ],
        },
        'A',
      ],
      [
        {
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            value: 'A',
          },
          imports: [
            {
              name: 'A',
              alias: 'AnoterSpec__A',
            },
          ],
        },
        'AnoterSpec__A',
      ],
    ];

    it.each(testCases)('value for %j should be %j', (input, expected) => {
      const result = getImportAliasForRefOrValue({
        ...input,
        context: contextWithSchemas,
      });

      expect(result).toStrictEqual(expected);
    });
  });
});
