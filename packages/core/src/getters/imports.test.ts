import { describe, expect, it } from 'vitest';

import type { ContextSpecs, GeneratorImport, ResolverValue } from '../types';
import {
  getAliasedImports,
  getImportAliasForRefOrValue,
  needCreateImportAlias,
} from './imports';

const baseContext: Omit<ContextSpecs, 'output'> = {
  specKey: 'spec',
  target: 'spec',
  workspace: '',
  spec: {},
};

const contextWithSchemas = {
  ...baseContext,
  output: {
    schemas: '/schemas',
  },
} as ContextSpecs;

const contextWithouSchemas = {
  ...baseContext,
  output: {
    schemas: undefined,
  },
} as ContextSpecs;

const baseResolvedValue: ResolverValue = {
  isRef: false,
  imports: [],
  hasReadonlyProps: false,
  isEnum: false,
  originalSchema: {},
  schemas: [],
  type: 'object',
  value: '',
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
        existingImports: [],
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
        context: contextWithouSchemas,
        existingImports: [],
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
          existingImports: [],
          name: 'A',
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'A',
                specKey: 'spec',
              },
            ],
          },
        },
        ['__A'],
      ],
      [
        {
          existingImports: [],
          name: 'A',
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'B',
                specKey: 'spec',
              },
            ],
          },
        },
        [undefined],
      ],
      [
        {
          existingImports: [
            {
              name: 'A',
              specKey: 'spec',
            },
          ],
          name: undefined,
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'A',
                specKey: 'another_spec',
              },
            ],
          },
        },
        ['AnotherSpec__A'],
      ],
      [
        {
          existingImports: [
            {
              name: 'A',
              specKey: 'spec',
            },
          ],
          name: undefined,
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'A',
                specKey: 'spec',
              },
            ],
          },
        },
        [undefined],
      ],
      [
        {
          existingImports: [
            {
              name: 'A',
              specKey: 'spec',
            },
          ],
          name: undefined,
          resolvedValue: {
            ...baseResolvedValue,
            isRef: true,
            imports: [
              {
                name: 'A',
                specKey: '45.yaml',
              },
            ],
          },
        },
        ['__45__A'],
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
    const existingImports: GeneratorImport[] = [
      { name: 'A', specKey: 'spec1' },
      { name: 'B', specKey: 'spec2' },
    ];

    const imp: GeneratorImport = {
      alias: 'AliasForC',
      name: 'C',
      specKey: 'spec3',
    };

    expect(needCreateImportAlias({ existingImports, imp })).toBeFalsy();
  });

  it('should return false when existingImports is empty', () => {
    const imp: GeneratorImport = { name: 'A', specKey: 'spec1' };

    expect(needCreateImportAlias({ existingImports: [], imp })).toBeFalsy();
  });

  it('should return false when import has not alias and import existingImports has not item with eq name and different specKey', () => {
    const existingImports: GeneratorImport[] = [
      { name: 'A', specKey: 'spec1' },
      { name: 'B', specKey: 'spec2' },
    ];

    const imp: GeneratorImport = { name: 'C', specKey: 'spec3' };

    expect(needCreateImportAlias({ existingImports, imp })).toBeFalsy();
  });

  it('should return true when name eq import name and import has not alias', () => {
    const existingImports: GeneratorImport[] = [
      { name: 'A', specKey: 'spec1' },
      { name: 'B', specKey: 'spec2' },
    ];

    const imp: GeneratorImport = { name: 'C', specKey: 'spec3' };

    expect(
      needCreateImportAlias({
        existingImports,
        imp,
        name: 'C',
      }),
    ).toBeTruthy();
  });

  it('should return true when import has not alias and and existingImports has item with eq name and different specKey', () => {
    const existingImports: GeneratorImport[] = [
      { name: 'A', specKey: 'spec1' },
      { name: 'B', specKey: 'spec2' },
    ];

    const imp: GeneratorImport = { name: 'A', specKey: 'spec3' };

    expect(needCreateImportAlias({ existingImports, imp })).toBeTruthy();
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
        context: contextWithouSchemas,
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
