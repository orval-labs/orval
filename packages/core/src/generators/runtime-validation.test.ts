import { describe, expect, it } from 'vite-plus/test';

import {
  emitResponseValidation,
  getSchemaOutputTypeRef,
  getSchemaValueRef,
  hasSchemaImport,
  isPrimitiveResponseType,
  normalizeRuntimeValidation,
  rewriteImportsForResponseValidation,
} from './runtime-validation';

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
