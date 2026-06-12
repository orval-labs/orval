import { describe, expect, it } from 'vitest';

import type { GeneratorImport } from '@orval/core';

import {
  appendImportsDelta,
  collectSplitMockTypeImports,
  mergeReturnedMockImports,
} from './imports';

describe('appendImportsDelta', () => {
  it('appends only entries added since sinceIndex', () => {
    const target: GeneratorImport[] = [{ name: 'Existing', values: true }];
    const source: GeneratorImport[] = [
      { name: 'Existing', values: true },
      { name: 'NewA', values: true },
      { name: 'NewB', values: false },
    ];

    appendImportsDelta(target, source, 1);

    expect(target).toEqual([
      { name: 'Existing', values: true },
      { name: 'NewA', values: true },
      { name: 'NewB', values: false },
    ]);
  });

  it('does not duplicate when source is the same array mutated in place (#3590)', () => {
    const shared: GeneratorImport[] = [];
    const target: GeneratorImport[] = [];

    shared.push({ name: 'getPetMock', values: true, schemaFactory: true });
    appendImportsDelta(target, shared, 0);

    shared.push({ name: 'PetMock', values: false, schemaFactory: true });
    appendImportsDelta(target, shared, 1);

    expect(target).toEqual([
      { name: 'getPetMock', values: true, schemaFactory: true },
      { name: 'PetMock', values: false, schemaFactory: true },
    ]);
    expect(target.length).toBe(2);
  });

  it('mergeReturnedMockImports appends returned imports when shared array is unchanged', () => {
    const shared: GeneratorImport[] = [];
    mergeReturnedMockImports(shared, 0, [
      { name: 'DomainStatusEnum', values: true },
    ]);

    expect(shared).toEqual([{ name: 'DomainStatusEnum', values: true }]);
  });

  it('mergeReturnedMockImports skips when shared array was mutated in place', () => {
    const shared: GeneratorImport[] = [];
    shared.push({ name: 'getPetMock', values: true, schemaFactory: true });
    mergeReturnedMockImports(shared, 0, shared);

    expect(shared).toEqual([
      { name: 'getPetMock', values: true, schemaFactory: true },
    ]);
    expect(shared.length).toBe(1);
  });
});

describe('collectSplitMockTypeImports', () => {
  it('collects types from nested oneOf split mock helpers', () => {
    const implementation = [
      'export const getExampleResponsePointInFutureAbsoluteMock = (',
      '  overrideResponse: Partial<PointInFutureAbsolute> = {},',
      '): PointInFutureAbsolute => ({ kind: "absolute" });',
    ].join('\n');

    expect(collectSplitMockTypeImports([implementation])).toEqual([
      { name: 'PointInFutureAbsolute', values: false },
    ]);
  });
});
