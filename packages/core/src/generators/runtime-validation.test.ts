import { describe, expect, it } from 'vitest';

import {
  emitResponseValidation,
  normalizeRuntimeValidation,
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
});
