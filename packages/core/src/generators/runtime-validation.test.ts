import ts from 'typescript';
import { describe, expect, it } from 'vite-plus/test';

import type { OpenApiSchemaObject } from '../types';
import { mergeDeep } from '../utils/merge-deep';
import {
  emitRequestBodyValidation,
  emitResponseValidation,
  getSchemaOutputTypeRef,
  getSchemaValueRef,
  hasSchemaImport,
  isPrimitiveResponseSchema,
  isPrimitiveResponseType,
  normalizeAngularRuntimeValidation,
  normalizeRuntimeValidation,
  rewriteImportsForResponseValidation,
} from './runtime-validation';
import { getStandardSchemaHelper } from './standard-schema-helper';

describe('isPrimitiveResponseSchema', () => {
  it.each<OpenApiSchemaObject>([
    { type: 'string', minLength: 2 },
    { type: 'integer', format: 'int64', minimum: 1 },
    { type: 'number' },
    { type: 'boolean', enum: [true] },
    { type: ['string', 'null'], enum: ['ready', 'done', null] },
    { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    { enum: ['ready', 'done'] },
    { const: false },
  ])('recognizes a scalar source schema: %j', (schema) => {
    expect(isPrimitiveResponseSchema(schema)).toBe(true);
  });

  it.each<OpenApiSchemaObject>([
    true,
    false,
    {},
    { $ref: '#/components/schemas/Count' },
    { type: 'array', items: { type: 'string' } },
    { type: 'object', properties: { count: { type: 'integer' } } },
    { anyOf: [{ type: 'string' }, { type: 'object' }] },
    { const: { count: 1 } },
  ])('does not guess a scalar schema: %j', (schema) => {
    expect(isPrimitiveResponseSchema(schema)).toBe(false);
  });
});

describe('emitResponseValidation', () => {
  describe('rxjs-map context', () => {
    it('emits a byte-identical parse pipe for the throw strategy', () => {
      expect(
        emitResponseValidation({
          schemaRef: 'PetsSchema',
          operationName: 'listPets',
          strategy: 'throw',
          context: 'rxjs-map',
        }),
      ).toBe('.pipe(map(data => PetsSchema.parse(data)))');
    });

    it('emits a safeParse + console.error + throw pipe for the both strategy', () => {
      expect(
        emitResponseValidation({
          schemaRef: 'PetsSchema',
          operationName: 'listPets',
          strategy: 'both',
          context: 'rxjs-map',
        }),
      ).toBe(
        ".pipe(map(data => { const result = PetsSchema.safeParse(data); if (!result.success) { console.error('[orval] listPets response validation failed', result.error); throw result.error; } return result.data; }))",
      );
    });
  });

  describe('clone-expression context', () => {
    it('emits a byte-identical parse call for the throw strategy', () => {
      expect(
        emitResponseValidation({
          schemaRef: 'PetsSchema',
          operationName: 'listPets',
          strategy: 'throw',
          context: 'clone-expression',
          inputExpression: 'response.body',
        }),
      ).toBe('PetsSchema.parse(response.body)');
    });

    it('IIFE-wraps the safeParse guard for the both strategy', () => {
      expect(
        emitResponseValidation({
          schemaRef: 'PetsSchema',
          operationName: 'listPets',
          strategy: 'both',
          context: 'clone-expression',
          inputExpression: 'response.body',
        }),
      ).toBe(
        "(() => { const result = PetsSchema.safeParse(response.body); if (!result.success) { console.error('[orval] listPets response validation failed', result.error); throw result.error; } return result.data; })()",
      );
    });
  });

  describe('fetch-assign context', () => {
    it('emits a byte-identical parse call for the throw strategy', () => {
      expect(
        emitResponseValidation({
          schemaRef: 'PetsSchema',
          operationName: 'listPets',
          strategy: 'throw',
          context: 'fetch-assign',
          inputExpression: 'parsedBody',
        }),
      ).toBe('PetsSchema.parse(parsedBody)');
    });

    it('IIFE-wraps the safeParse guard for the both strategy', () => {
      expect(
        emitResponseValidation({
          schemaRef: 'PetsSchema',
          operationName: 'listPets',
          strategy: 'both',
          context: 'fetch-assign',
          inputExpression: 'parsedBody',
        }),
      ).toBe(
        "(() => { const result = PetsSchema.safeParse(parsedBody); if (!result.success) { console.error('[orval] listPets response validation failed', result.error); throw result.error; } return result.data; })()",
      );
    });
  });

  describe('parse-fn context', () => {
    it('emits a byte-identical bare method reference for the throw strategy', () => {
      expect(
        emitResponseValidation({
          schemaRef: 'PetsSchema',
          operationName: 'listPets',
          strategy: 'throw',
          context: 'parse-fn',
        }),
      ).toBe('PetsSchema.parse');
    });

    it('emits an arrow function with the safeParse guard for the both strategy', () => {
      expect(
        emitResponseValidation({
          schemaRef: 'PetsSchema',
          operationName: 'listPets',
          strategy: 'both',
          context: 'parse-fn',
        }),
      ).toBe(
        "(raw) => { const result = PetsSchema.safeParse(raw); if (!result.success) { console.error('[orval] listPets response validation failed', result.error); throw result.error; } return result.data; }",
      );
    });
  });

  describe('operationName escaping', () => {
    it('escapes single quotes and backslashes so the log literal stays valid', () => {
      // `override.operationName` can return arbitrary strings, so a name with a
      // single quote or backslash must not break the generated string literal.
      expect(
        emitResponseValidation({
          schemaRef: 'PetsSchema',
          operationName: "list\\Pets's",
          strategy: 'both',
          context: 'rxjs-map',
        }),
      ).toBe(
        ".pipe(map(data => { const result = PetsSchema.safeParse(data); if (!result.success) { console.error('[orval] list\\\\Pets\\'s response validation failed', result.error); throw result.error; } return result.data; }))",
      );
    });
  });
});

describe('normalizeRuntimeValidation', () => {
  it('treats undefined as disabled with the throw strategy', () => {
    expect(normalizeRuntimeValidation(undefined)).toEqual({
      enabled: false,
      strategy: 'throw',
    });
  });

  it('treats false as disabled with the throw strategy', () => {
    expect(normalizeRuntimeValidation(false)).toEqual({
      enabled: false,
      strategy: 'throw',
    });
  });

  it('treats true as enabled with the throw strategy', () => {
    expect(normalizeRuntimeValidation(true)).toEqual({
      enabled: true,
      strategy: 'throw',
    });
  });

  it('treats { strategy: "throw" } as enabled with the throw strategy', () => {
    expect(normalizeRuntimeValidation({ strategy: 'throw' })).toEqual({
      enabled: true,
      strategy: 'throw',
    });
  });

  it('treats { strategy: "both" } as enabled with the both strategy', () => {
    expect(normalizeRuntimeValidation({ strategy: 'both' })).toEqual({
      enabled: true,
      strategy: 'both',
    });
  });

  it('is idempotent: returns an already-normalized object unchanged', () => {
    // Guards the per-operation query inheritance path, which can hand an
    // already-normalized global value back into normalization.
    expect(
      normalizeRuntimeValidation({ enabled: false, strategy: 'throw' }),
    ).toEqual({ enabled: false, strategy: 'throw' });
    expect(
      normalizeRuntimeValidation({ enabled: true, strategy: 'both' }),
    ).toEqual({ enabled: true, strategy: 'both' });
  });
});

describe('emitRequestBodyValidation', () => {
  it('emits a bare parse call for the throw strategy', () => {
    expect(
      emitRequestBodyValidation({
        schemaRef: 'CreatePetsBody',
        operationName: 'createPets',
        strategy: 'throw',
        inputExpression: 'createPetsBody',
      }),
    ).toBe('CreatePetsBody.parse(createPetsBody)');
  });

  it('IIFE-wraps a request-body safeParse guard for the both strategy', () => {
    expect(
      emitRequestBodyValidation({
        schemaRef: 'CreatePetsBody',
        operationName: 'createPets',
        strategy: 'both',
        inputExpression: 'createPetsBody',
      }),
    ).toBe(
      "(() => { const result = CreatePetsBody.safeParse(createPetsBody); if (!result.success) { console.error('[orval] createPets request body validation failed', result.error); throw result.error; } return result.data; })()",
    );
  });

  it('skips parsing an omitted optional body', () => {
    expect(
      emitRequestBodyValidation({
        schemaRef: 'Pet',
        operationName: 'patchPet',
        strategy: 'throw',
        inputExpression: 'pet',
        isOptional: true,
      }),
    ).toBe('pet === undefined ? undefined : Pet.parse(pet)');
  });

  it('encodes the parsed body back through the schema', () => {
    expect(
      emitRequestBodyValidation({
        schemaRef: 'Pet',
        operationName: 'patchPet',
        strategy: 'throw',
        inputExpression: 'pet',
        isOptional: true,
        encode: true,
      }),
    ).toBe('pet === undefined ? undefined : zod.encode(Pet, Pet.parse(pet))');
  });
});

describe('normalizeAngularRuntimeValidation', () => {
  it('leaves request bodies off for the boolean and strategy forms', () => {
    expect(normalizeAngularRuntimeValidation(undefined)).toEqual({
      enabled: false,
      strategy: 'throw',
      requestBodies: false,
    });
    expect(normalizeAngularRuntimeValidation(true)).toEqual({
      enabled: true,
      strategy: 'throw',
      requestBodies: false,
    });
    expect(normalizeAngularRuntimeValidation({ strategy: 'both' })).toEqual({
      enabled: true,
      strategy: 'both',
      requestBodies: false,
    });
  });

  it('enables request bodies with the throw strategy when no strategy is given', () => {
    expect(normalizeAngularRuntimeValidation({ requestBodies: true })).toEqual({
      enabled: true,
      strategy: 'throw',
      requestBodies: true,
    });
  });

  it('keeps the configured strategy alongside request bodies', () => {
    expect(
      normalizeAngularRuntimeValidation({
        strategy: 'both',
        requestBodies: true,
      }),
    ).toEqual({ enabled: true, strategy: 'both', requestBodies: true });
  });

  it('is idempotent on an already-normalized value', () => {
    const normalized = {
      enabled: true,
      strategy: 'throw',
      requestBodies: true,
    } as const;
    expect(normalizeAngularRuntimeValidation(normalized)).toEqual(normalized);
  });
});

describe('isPrimitiveResponseType', () => {
  it('treats primitives, void and unknown as primitive', () => {
    for (const t of ['string', 'number', 'boolean', 'void', 'unknown']) {
      expect(isPrimitiveResponseType(t)).toBe(true);
    }
  });

  it('treats schema names and undefined as non-primitive', () => {
    expect(isPrimitiveResponseType('Pets')).toBe(false);
    expect(isPrimitiveResponseType(undefined)).toBe(false);
  });
});

describe('hasSchemaImport', () => {
  const imports = [{ name: 'Pets' }, { name: 'Error' }];

  it('finds an import by exact name', () => {
    expect(hasSchemaImport(imports, 'Pets')).toBe(true);
  });

  it('misses absent names and undefined', () => {
    expect(hasSchemaImport(imports, 'Pet')).toBe(false);
    expect(hasSchemaImport(imports, undefined)).toBe(false);
  });
});

describe('getSchemaValueRef', () => {
  it('renames Error to ErrorSchema, leaves other names untouched', () => {
    expect(getSchemaValueRef('Error')).toBe('ErrorSchema');
    expect(getSchemaValueRef('Pets')).toBe('Pets');
  });
});

describe('getSchemaOutputTypeRef', () => {
  it('appends the Output suffix', () => {
    expect(getSchemaOutputTypeRef('Pets')).toBe('PetsOutput');
    expect(getSchemaOutputTypeRef('PetsSchema')).toBe('PetsSchemaOutput');
  });
});

describe('rewriteImportsForResponseValidation', () => {
  const imports = [
    { name: 'Pets', schemaName: 'Pets' },
    { name: 'Error', schemaName: 'Error' },
  ];

  it('flips the schema import to a value import and appends the Output alias', () => {
    expect(rewriteImportsForResponseValidation(imports, 'Pets')).toEqual([
      { name: 'Pets', schemaName: 'Pets', values: true },
      { name: 'Error', schemaName: 'Error' },
      { name: 'PetsOutput', zodBaseName: 'Pets' },
    ]);
  });

  it('skips the Output alias when includeOutputType is false', () => {
    expect(
      rewriteImportsForResponseValidation(imports, 'Pets', {
        includeOutputType: false,
      }),
    ).toEqual([
      { name: 'Pets', schemaName: 'Pets', values: true },
      { name: 'Error', schemaName: 'Error' },
    ]);
  });

  it('does not mutate the input array', () => {
    const before = structuredClone(imports);
    rewriteImportsForResponseValidation(imports, 'Pets');
    expect(imports).toEqual(before);
  });
});

describe('standardSchema', () => {
  it('emits orvalParseStandardSchema for throw and orvalSafeParseStandardSchema for both', () => {
    const base = {
      schemaRef: 'Pets',
      operationName: 'listPets',
      context: 'fetch-assign' as const,
      inputExpression: 'parsedBody',
      standardSchema: true,
    };
    expect(emitResponseValidation({ ...base, strategy: 'throw' })).toBe(
      'orvalParseStandardSchema(Pets, parsedBody)',
    );
    expect(emitResponseValidation({ ...base, strategy: 'both' })).toContain(
      'orvalSafeParseStandardSchema(Pets, parsedBody)',
    );
  });

  it('keeps the zod emission when the flag is off', () => {
    expect(
      emitResponseValidation({
        schemaRef: 'Pets',
        operationName: 'listPets',
        strategy: 'throw',
        context: 'fetch-assign',
        inputExpression: 'parsedBody',
      }),
    ).toBe('Pets.parse(parsedBody)');
  });

  it('normalizes the flag only when set', () => {
    expect(normalizeRuntimeValidation({ strategy: 'throw' })).toEqual({
      enabled: true,
      strategy: 'throw',
    });
    expect(
      normalizeRuntimeValidation({ strategy: 'throw', standardSchema: true }),
    ).toEqual({ enabled: true, strategy: 'throw', standardSchema: true });
  });

  it('declares only the helpers a file calls', () => {
    expect(getStandardSchemaHelper('Pets.parse(x)')).toBe('');
    const both = getStandardSchemaHelper('orvalSafeParseStandardSchema(P, x)');
    expect(both).toContain('function orvalSafeParseStandardSchema');
    expect(both).not.toContain('function orvalParseStandardSchema');
    expect(getStandardSchemaHelper('orvalParseStandardSchema(P, x)')).toContain(
      'function orvalParseStandardSchema',
    );
  });
});

describe('standardSchema request bodies', () => {
  const base = {
    schemaRef: 'CreatePetsBody',
    operationName: 'createPets',
    inputExpression: 'createPetsBody',
    standardSchema: true,
  };

  it('emits the throwing helper for the throw strategy', () => {
    expect(emitRequestBodyValidation({ ...base, strategy: 'throw' })).toBe(
      'orvalParseStandardSchema(CreatePetsBody, createPetsBody)',
    );
  });

  it('IIFE-wraps the safe helper for the both strategy', () => {
    expect(emitRequestBodyValidation({ ...base, strategy: 'both' })).toBe(
      "(() => { const result = orvalSafeParseStandardSchema(CreatePetsBody, createPetsBody); if (!result.success) { console.error('[orval] createPets request body validation failed', result.error); throw result.error; } return result.data; })()",
    );
  });

  it('passes an omitted optional body through', () => {
    expect(
      emitRequestBodyValidation({
        ...base,
        strategy: 'throw',
        isOptional: true,
      }),
    ).toBe(
      'createPetsBody === undefined ? undefined : orvalParseStandardSchema(CreatePetsBody, createPetsBody)',
    );
  });
});

describe('standardSchema contexts', () => {
  const base = {
    schemaRef: 'Pets',
    operationName: 'listPets',
    standardSchema: true,
  };

  it('uses the helper inside rxjs-map', () => {
    expect(
      emitResponseValidation({
        ...base,
        strategy: 'throw',
        context: 'rxjs-map',
      }),
    ).toBe('.pipe(map(data => orvalParseStandardSchema(Pets, data)))');
  });

  it('wraps parse-fn in an arrow instead of a bare reference', () => {
    expect(
      emitResponseValidation({
        ...base,
        strategy: 'throw',
        context: 'parse-fn',
      }),
    ).toBe('(raw: unknown) => orvalParseStandardSchema(Pets, raw)');
  });

  it('uses the safe helper in the both guard', () => {
    expect(
      emitResponseValidation({
        ...base,
        strategy: 'both',
        context: 'parse-fn',
      }),
    ).toContain('orvalSafeParseStandardSchema(Pets, raw)');
  });

  it('annotates the parse-fn parameter so it typechecks without context', () => {
    expect(
      emitResponseValidation({
        ...base,
        strategy: 'both',
        context: 'parse-fn',
      }),
    ).toMatch(/^\(raw: unknown\) => \{/);
  });
});

describe('normalizeAngularRuntimeValidation standardSchema', () => {
  it('keeps the flag next to requestBodies', () => {
    expect(
      normalizeAngularRuntimeValidation({
        strategy: 'both',
        requestBodies: true,
        standardSchema: true,
      }),
    ).toEqual({
      enabled: true,
      strategy: 'both',
      standardSchema: true,
      requestBodies: true,
    });
  });

  it('omits the flag by default', () => {
    expect(normalizeAngularRuntimeValidation({ strategy: 'throw' })).toEqual({
      enabled: true,
      strategy: 'throw',
      requestBodies: false,
    });
  });
});

describe('standardSchema parse-fn with a composed schema', () => {
  it('binds the schema once instead of rebuilding it per response', () => {
    const snippet = emitResponseValidation({
      schemaRef: 'zod.array(Item)',
      operationName: 'listItems',
      strategy: 'throw',
      context: 'parse-fn',
      standardSchema: true,
    });

    expect(snippet).toBe(
      '((schema) => (raw: unknown) => orvalParseStandardSchema(schema, raw))(zod.array(Item))',
    );
  });

  it('keeps the plain arrow for a named schema', () => {
    expect(
      emitResponseValidation({
        schemaRef: 'Pet',
        operationName: 'getPet',
        strategy: 'throw',
        context: 'parse-fn',
        standardSchema: true,
      }),
    ).toBe('(raw: unknown) => orvalParseStandardSchema(Pet, raw)');
  });
});

describe('getStandardSchemaHelper detection', () => {
  it('ignores a call quoted in a JSDoc description', () => {
    expect(
      getStandardSchemaHelper(
        '/**\n * Use orvalParseStandardSchema(Pets, value) here\n */\nexport const listPets = () => 1;',
      ),
    ).toBe('');
  });

  it('still finds a call after a JSDoc block', () => {
    expect(
      getStandardSchemaHelper(
        '/** doc */\nconst x = orvalParseStandardSchema(P, y);',
      ),
    ).toContain('function orvalParseStandardSchema');
  });

  it('keeps a call that follows a string literal containing a comment opener', () => {
    expect(
      getStandardSchemaHelper(
        "const re = '/api/**'; foo(orvalParseStandardSchema(Pets, x));\n/** doc */",
      ),
    ).toContain('function orvalParseStandardSchema');
  });

  it('ignores a longer identifier that ends in a helper name', () => {
    expect(getStandardSchemaHelper('myorvalParseStandardSchema(P, x)')).toBe(
      '',
    );
  });
});

describe('getStandardSchemaHelper output', () => {
  it('declares each helper once and types them without casts', () => {
    const helper = getStandardSchemaHelper('orvalParseStandardSchema(P, x)');
    expect(helper.match(/function orvalSafeParseStandardSchema/g)).toHaveLength(
      1,
    );
    expect(helper.match(/function orvalParseStandardSchema/g)).toHaveLength(1);
    expect(helper).not.toContain(' as ');
  });
});

describe('standardSchema override merging', () => {
  it('keeps an explicit false and leaves an absent flag absent', () => {
    expect(
      normalizeRuntimeValidation({ strategy: 'throw', standardSchema: false }),
    ).toEqual({ enabled: true, strategy: 'throw', standardSchema: false });
    expect(normalizeRuntimeValidation({})).toEqual({
      enabled: true,
      strategy: 'throw',
    });
    expect(
      normalizeAngularRuntimeValidation({ standardSchema: false }),
    ).toEqual({
      enabled: true,
      strategy: 'throw',
      standardSchema: false,
      requestBodies: false,
    });
  });

  it('lets a tag override switch off a global true through mergeDeep', () => {
    const global = {
      runtimeValidation: normalizeRuntimeValidation({
        strategy: 'throw',
        standardSchema: true,
      }),
    };
    const tag = {
      runtimeValidation: normalizeRuntimeValidation({
        standardSchema: false,
      }),
    };

    expect(mergeDeep(global, tag).runtimeValidation.standardSchema).toBe(false);
  });

  it('inherits the global flag when the override does not mention it', () => {
    const global = {
      runtimeValidation: normalizeRuntimeValidation({ standardSchema: true }),
    };
    const tag = {
      runtimeValidation: normalizeRuntimeValidation({ strategy: 'both' }),
    };

    expect(mergeDeep(global, tag).runtimeValidation).toEqual({
      enabled: true,
      strategy: 'both',
      standardSchema: true,
    });
  });
});

describe('standard schema helper source', () => {
  const helper = getStandardSchemaHelper('orvalParseStandardSchema(P, x)');

  it('parses as .tsx, where arrow generics do not', () => {
    const { diagnostics } = ts.transpileModule(helper, {
      fileName: 'helper.tsx',
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve },
    });

    expect(diagnostics).toEqual([]);
  });

  it('handles the rejection of an unsupported async result', () => {
    expect(helper).toContain('result.then(undefined, () => {})');
  });

  it('uses no shadowable global type names', () => {
    expect(helper).not.toMatch(/\b(PropertyKey|ReadonlyArray|PromiseLike)\b/);
  });
});
