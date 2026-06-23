import { describe, expect, it } from 'vitest';

import {
  buildKnownSchemaFactoryImportSets,
  collectRecoveredSchemaFactoryImports,
  collectSchemaFactoryImportsFromImplementation,
  mergeGeneratorImports,
} from './mock-imports';

describe('buildKnownSchemaFactoryImportSets', () => {
  it('maps schema names to consolidated faker symbols', () => {
    const known = buildKnownSchemaFactoryImportSets([
      'Pet',
      'PetDetailResponse',
    ]);

    expect(known.factoryNames.has('getPetMock')).toBe(true);
    expect(known.typeNames.has('PetMock')).toBe(true);
    expect(known.factoryNames.has('getPetDetailResponseMock')).toBe(true);
  });
});

describe('collectSchemaFactoryImportsFromImplementation', () => {
  it('collects factory and mock type imports from strict delegation casts', () => {
    const implementation = `export const getFooResponseMock = (): FooMock => ({ bar: { ...getBarMock() as BarMock } });`;

    expect(
      collectSchemaFactoryImportsFromImplementation(implementation),
    ).toEqual([
      { name: 'getBarMock', values: true, schemaFactory: true },
      { name: 'BarMock', values: false, schemaFactory: true },
    ]);
  });

  it('ignores split response helpers when filtered by known component schemas (#3590)', () => {
    const implementation = [
      'export const getStorePetResponseMock = (): PetDetailResponseMock => ({',
      '  pet: { ...getPetMock() as PetMock },',
      '  variant: getStorePetResponsePetDetailResponseItemMock(),',
      '});',
    ].join('\n');

    const known = buildKnownSchemaFactoryImportSets([
      'Pet',
      'PetDetailResponse',
    ]);

    expect(
      collectSchemaFactoryImportsFromImplementation(implementation, known),
    ).toEqual([
      { name: 'getPetMock', values: true, schemaFactory: true },
      { name: 'PetMock', values: false, schemaFactory: true },
    ]);
  });
});

describe('collectRecoveredSchemaFactoryImports', () => {
  it('uses component schema names to recover consolidated faker imports', () => {
    const implementation = [
      'export const getStorePetResponseMock = (): PetDetailResponseMock => ({',
      '  pet: { ...getPetMock() as PetMock },',
      '});',
    ].join('\n');

    expect(
      collectRecoveredSchemaFactoryImports(implementation, ['Pet']),
    ).toEqual([
      { name: 'getPetMock', values: true, schemaFactory: true },
      { name: 'PetMock', values: false, schemaFactory: true },
    ]);
  });
});

describe('mergeGeneratorImports', () => {
  it('prefers value imports over type-only duplicates', () => {
    expect(
      mergeGeneratorImports(
        [{ name: 'PetMock', values: false, schemaFactory: true }],
        [{ name: 'PetMock', values: true, schemaFactory: true }],
      ),
    ).toEqual([{ name: 'PetMock', values: true, schemaFactory: true }]);
  });
});
