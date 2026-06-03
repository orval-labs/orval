import type { ResReqTypesValue } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  applyStrictMockReturnType,
  buildStrictMockTypeFileHeader,
  collectStrictMockSchemaNamesFromUsage,
  collectStrictMockSchemaTypeNames,
  dedupeStrictMockTypeDeclarations,
  getMockFactoryReturnType,
  getMockFactorySignatureParts,
  getSchemaTypeNamesFromResponses,
  getSimpleSchemaReturnType,
  getStrictMockHelperTypeDeclarations,
  getStrictMockTypeDeclaration,
  getStrictMockTypeDeclarations,
  getStrictMockTypeName,
  isStrictMock,
} from './mock-types';

describe('mock-types', () => {
  describe('isStrictMock', () => {
    it('is true only when required and nonNullable are both true', () => {
      expect(isStrictMock()).toBe(false);
      expect(isStrictMock({ required: true })).toBe(false);
      expect(isStrictMock({ nonNullable: true })).toBe(false);
      expect(isStrictMock({ required: true, nonNullable: true })).toBe(true);
    });
  });

  describe('getStrictMockHelperTypeDeclarations', () => {
    it('emits KeysWithNull and MockWithNullableOverrides helpers', () => {
      expect(getStrictMockHelperTypeDeclarations()).toContain(
        'export type KeysWithNull<O>',
      );
      expect(getStrictMockHelperTypeDeclarations()).toContain(
        'export type MockWithNullableOverrides',
      );
    });
  });

  describe('getStrictMockTypeDeclarations', () => {
    it('deduplicates schema names and joins mock type aliases', () => {
      const result = getStrictMockTypeDeclarations(['Pet', 'Pet', 'Error']);

      expect(result).toBe(
        [
          getStrictMockTypeDeclaration('Pet'),
          getStrictMockTypeDeclaration('Error'),
        ].join('\n\n'),
      );
      expect(result.match(/export type PetMock/g)?.length).toBe(1);
      expect(result.match(/export type ErrorMock/g)?.length).toBe(1);
    });

    it('returns an empty string when no schema names are provided', () => {
      expect(getStrictMockTypeDeclarations([])).toBe('');
    });
  });

  describe('getStrictMockTypeDeclaration', () => {
    it('emits a Required/NonNullable mapped type alias', () => {
      expect(getStrictMockTypeDeclaration('Pet')).toBe(
        'export type PetMock = {\n  [K in keyof Required<Pet>]: NonNullable<Required<Pet>[K]>;\n};',
      );
    });
  });

  describe('getMockFactoryReturnType', () => {
    it('returns the strict mock alias when both flags are set', () => {
      expect(
        getMockFactoryReturnType('Pet', {
          required: true,
          nonNullable: true,
        }),
      ).toBe('PetMock');
    });

    it('returns the original type when either flag is unset', () => {
      expect(getMockFactoryReturnType('Pet')).toBe('Pet');
      expect(getMockFactoryReturnType('Pet', { required: true })).toBe('Pet');
    });
  });

  describe('getMockFactorySignatureParts', () => {
    const strictOptions = { required: true, nonNullable: true } as const;

    it('uses generic override narrowing for strict overridable factories', () => {
      expect(
        getMockFactorySignatureParts('Pet', strictOptions, {
          isOverridable: true,
        }),
      ).toEqual({
        param: '<O extends Partial<Pet> = {}>(overrideResponse?: O)',
        returnType: 'MockWithNullableOverrides<Pet, O, PetMock>',
        returnCast: ' as MockWithNullableOverrides<Pet, O, PetMock>',
      });
    });

    it('keeps the plain signature when strict flags are unset', () => {
      expect(
        getMockFactorySignatureParts('Pet', undefined, {
          isOverridable: true,
        }),
      ).toEqual({
        param: 'overrideResponse: Partial<Pet> = {}',
        returnType: 'Pet',
        returnCast: '',
      });
    });

    it('returns only the strict mock alias when not overridable', () => {
      expect(
        getMockFactorySignatureParts('Pet', strictOptions, {
          isOverridable: false,
        }),
      ).toEqual({
        param: '',
        returnType: 'PetMock',
        returnCast: '',
      });
    });
  });

  describe('getSimpleSchemaReturnType', () => {
    it('returns the type when it matches a known schema name', () => {
      expect(getSimpleSchemaReturnType('Pet', ['Pet', 'Error'])).toBe('Pet');
      expect(getSimpleSchemaReturnType('Pet | Error', ['Pet', 'Error'])).toBe(
        undefined,
      );
    });
  });

  describe('applyStrictMockReturnType', () => {
    it('replaces known schema names with Mock suffixes', () => {
      expect(applyStrictMockReturnType('Pet | Error', ['Pet', 'Error'])).toBe(
        'PetMock | ErrorMock',
      );
      expect(applyStrictMockReturnType('Pet[]', ['Pet'])).toBe('PetMock[]');
    });

    it('does not partially replace longer schema names', () => {
      expect(
        applyStrictMockReturnType('PetWithTag', ['Pet', 'PetWithTag']),
      ).toBe('PetWithTagMock');
    });
  });

  describe('dedupeStrictMockTypeDeclarations', () => {
    it('hoists helpers and schema mock aliases once for concatenated operation mocks', () => {
      const perOp = `${getStrictMockHelperTypeDeclarations()}\n\n${getStrictMockTypeDeclaration('Pet')}\n\nexport const getGetPetResponseMock = () => ({})`;
      const duplicated = `${perOp}\n\n${perOp}\n\n${perOp}`;

      const result = dedupeStrictMockTypeDeclarations(duplicated);

      expect(result.match(/export type KeysWithNull/g)?.length).toBe(1);
      expect(
        result.match(/export type MockWithNullableOverrides/g)?.length,
      ).toBe(1);
      expect(result.match(/export type PetMock/g)?.length).toBe(1);
      expect(result.match(/export const getGetPetResponseMock/g)?.length).toBe(
        3,
      );
    });

    it('strips invalid strict mock aliases for factory value imports', () => {
      const invalid = `export type getPetMockMock = {
  [K in keyof Required<getPetMock>]: NonNullable<Required<getPetMock>[K]>;
};\n\nexport const getListPetsResponseMock = () => []`;

      const result = dedupeStrictMockTypeDeclarations(invalid);

      expect(result).not.toContain('getPetMockMock');
      expect(result).not.toContain('Required<getPetMock>');
    });
  });

  describe('getSchemaTypeNamesFromResponses', () => {
    it('ignores value and schema-factory imports', () => {
      const responses = [
        {
          value: 'Pet[]',
          imports: [
            { name: 'Pet', values: false },
            { name: 'getPetMock', values: true, schemaFactory: true },
          ],
        },
      ] as ResReqTypesValue[];

      expect(getSchemaTypeNamesFromResponses(responses)).toEqual(['Pet']);
    });

    it('collects schema names from response values and imports', () => {
      const responses = [
        {
          value: 'Pet',
          imports: [{ name: 'Pet', values: false }],
        },
        {
          value: 'Error[]',
          imports: [{ name: 'Error', values: false }],
        },
      ] as ResReqTypesValue[];

      expect(getSchemaTypeNamesFromResponses(responses).toSorted()).toEqual([
        'Error',
        'Pet',
      ]);
    });

    it('uses import aliases when present', () => {
      const responses = [
        {
          imports: [{ name: 'Widget', alias: 'CustomWidget', values: false }],
        },
      ] as ResReqTypesValue[];

      expect(getSchemaTypeNamesFromResponses(responses)).toEqual([
        'CustomWidget',
      ]);
    });

    it('skips responses with falsy values', () => {
      const responses = [
        {
          value: '',
          imports: [{ name: 'Ignored', values: false }],
        },
        {
          value: undefined,
          imports: [{ name: 'AlsoIgnored', values: false }],
        },
      ] as ResReqTypesValue[];

      expect(getSchemaTypeNamesFromResponses(responses)).toEqual([
        'Ignored',
        'AlsoIgnored',
      ]);
    });
  });

  describe('getStrictMockTypeName', () => {
    it('appends Mock to the schema name', () => {
      expect(getStrictMockTypeName('Pet')).toBe('PetMock');
    });
  });

  describe('buildStrictMockTypeFileHeader', () => {
    it('includes helpers and deduped schema mock aliases', () => {
      const header = buildStrictMockTypeFileHeader(['Pet', 'Pet']);

      expect(header).toContain('export type KeysWithNull');
      expect(header.match(/export type PetMock/g)?.length).toBe(1);
    });
  });

  describe('collectStrictMockSchemaTypeNames', () => {
    it('reads schema names from strict mock alias declarations', () => {
      const names = collectStrictMockSchemaTypeNames(
        getStrictMockTypeDeclaration('Pet'),
      );

      expect(names).toEqual(['Pet']);
    });
  });

  describe('collectStrictMockSchemaNamesFromUsage', () => {
    it('collects schema names referenced by strict mock factories', () => {
      const names = collectStrictMockSchemaNamesFromUsage(
        '(): MockWithNullableOverrides<Pet, O, PetMock> => ({}) as MockWithNullableOverrides<Pet, O, PetMock>;\nexport const getListPetsResponseMock = (): PetMock[] => []',
      );

      expect(names).toEqual(['Pet']);
    });
  });

  describe('dedupeStrictMockTypeDeclarations with usage-only mocks', () => {
    it('hoists helpers when factories reference strict types without inline declarations', () => {
      const body = `export const getGetPetResponseMock = (): MockWithNullableOverrides<Pet, O, PetMock> => ({}) as MockWithNullableOverrides<Pet, O, PetMock>;\nexport const getListPetsResponseMock = (): PetMock[] => []`;

      const result = dedupeStrictMockTypeDeclarations(body);

      expect(result).toContain('export type KeysWithNull');
      expect(result).toContain('export type PetMock');
      expect(result.match(/export type PetMock/g)?.length).toBe(1);
    });
  });
});
