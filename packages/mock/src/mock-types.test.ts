import type { ResReqTypesValue } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  applyStrictMockReturnType,
  buildStrictMockTypeFileHeader,
  collectStrictMockSchemaTypeNamesFromImplementation,
  dedupeStrictMockTypeDeclarations,
  getMockFactoryReturnType,
  getMockFactorySignatureParts,
  getSchemaTypeNamesFromResponses,
  getSimpleSchemaReturnType,
  getStrictMockSchemaKindsFromResponses,
  getStrictMockHelperTypeDeclarations,
  classifyStrictMockSchemaType,
  getStrictMockTypeDeclaration,
  getStrictMockTypeDeclarations,
  getStrictMockTypeName,
  isSchemaNullableAtRoot,
  isStrictMock,
} from './mock-types';
import { createTestContextSpec } from '../../core/src/test-utils/context';

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

  describe('classifyStrictMockSchemaType', () => {
    it('classifies object, enum, array, scalar, and binary schemas', () => {
      expect(
        classifyStrictMockSchemaType({
          type: 'object',
          properties: { id: { type: 'string' } },
        }),
      ).toBe('object');
      expect(
        classifyStrictMockSchemaType({
          type: 'string',
          enum: ['active', 'inactive'],
        }),
      ).toBe('alias');
      expect(
        classifyStrictMockSchemaType({
          $ref: '#/components/schemas/Pet',
        }),
      ).toBe('object');
      expect(
        classifyStrictMockSchemaType({
          type: 'array',
          items: { type: 'string' },
        }),
      ).toBe('alias');
      expect(classifyStrictMockSchemaType({ type: 'number' })).toBe('alias');
      expect(
        classifyStrictMockSchemaType({ type: 'string', format: 'binary' }),
      ).toBe('binary');
      expect(
        classifyStrictMockSchemaType({
          oneOf: [{ type: 'string' }, { type: 'number' }],
        }),
      ).toBe('alias');
      expect(
        classifyStrictMockSchemaType({
          oneOf: [{ $ref: '#/components/schemas/Pet' }],
        }),
      ).toBe('object');
    });

    it('resolves $ref targets before classifying', () => {
      const context = createTestContextSpec({
        spec: {
          components: {
            schemas: {
              Status: {
                type: 'string',
                enum: ['active', 'inactive'],
              },
            },
          },
        },
      });

      expect(
        classifyStrictMockSchemaType(
          { $ref: '#/components/schemas/Status' },
          context,
        ),
      ).toBe('alias');
    });
  });

  describe('isSchemaNullableAtRoot', () => {
    it('detects nullable object schemas', () => {
      expect(isSchemaNullableAtRoot({ type: 'object', nullable: true })).toBe(
        true,
      );
      expect(isSchemaNullableAtRoot({ type: ['object', 'null'] })).toBe(true);
      expect(isSchemaNullableAtRoot({ type: 'object' })).toBe(false);
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
    it('emits a Required/NonNullable mapped type alias for objects', () => {
      expect(getStrictMockTypeDeclaration('Pet')).toBe(
        'export type PetMock = {\n  [K in keyof Required<Pet>]: NonNullable<Required<Pet>[K]>;\n};',
      );
    });

    it('aliases enum and scalar schemas to the source type', () => {
      expect(getStrictMockTypeDeclaration('Status', 'alias')).toBe(
        'export type StatusMock = Status;',
      );
      expect(getStrictMockTypeDeclaration('Score', 'alias')).toBe(
        'export type ScoreMock = Score;',
      );
    });

    it('uses ArrayBuffer for binary schema mocks', () => {
      expect(getStrictMockTypeDeclaration('PhotoUpload', 'binary')).toBe(
        'export type PhotoUploadMock = ArrayBuffer;',
      );
    });

    it('allows null on object mocks when the schema itself is nullable', () => {
      expect(
        getStrictMockTypeDeclaration('Widget', 'object', {
          schemaNullableAtRoot: true,
        }),
      ).toBe(
        'export type WidgetMock = {\n  [K in keyof Required<Widget>]: NonNullable<Required<Widget>[K]>;\n} | null;',
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
    const strictOptions = {
      mockOptions: { required: true, nonNullable: true } as const,
      strictSchemaTypeNames: ['Pet'],
    };

    it('prepends helpers and schema mock aliases once from structured type names', () => {
      const body =
        'export const getGetPetResponseMock = () => ({})\n\nexport const getListPetsResponseMock = () => []';

      const result = dedupeStrictMockTypeDeclarations(body, strictOptions);

      expect(result.match(/export type KeysWithNull/g)?.length).toBe(1);
      expect(
        result.match(/export type MockWithNullableOverrides/g)?.length,
      ).toBe(1);
      expect(result.match(/export type PetMock/g)?.length).toBe(1);
      expect(result.indexOf('export type PetMock')).toBeLessThan(
        result.indexOf('export const getGetPetResponseMock'),
      );
      expect(result.match(/export const getGetPetResponseMock/g)?.length).toBe(
        1,
      );
      expect(
        result.match(/export const getListPetsResponseMock/g)?.length,
      ).toBe(1);
    });

    it('is a no-op for non-strict mocks even when a schema is named WidgetMock', () => {
      const body = `import type { WidgetMock } from './model';\n\nexport const getGetWidgetResponseMock = (overrideResponse: Partial<WidgetMock> = {}) => ({ ...overrideResponse, id: faker.number.int() })`;

      const result = dedupeStrictMockTypeDeclarations(body);

      expect(result).toBe(body);
      expect(result).not.toContain('export type KeysWithNull');
      expect(result).not.toContain('Required<Widget>');
    });

    it('returns implementation unchanged when strict mode is on but no type names are provided', () => {
      const body = 'export const getGetPetResponseMock = () => ({})';

      const result = dedupeStrictMockTypeDeclarations(body, {
        mockOptions: { required: true, nonNullable: true },
      });

      expect(result).toBe(body);
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

  describe('collectStrictMockSchemaTypeNamesFromImplementation', () => {
    it('collects schema names from strict mock factory signatures', () => {
      const implementation = [
        'export const getAdminOperationEntityDtoMock = <O extends Partial<AdminOperationEntityDto> = {}>(overrideResponse?: O): MockWithNullableOverrides<AdminOperationEntityDto, O, AdminOperationEntityDtoMock> => ({}) as MockWithNullableOverrides<AdminOperationEntityDto, O, AdminOperationEntityDtoMock>;',
        'export const getGetTenantsResponseMock = (): TenantInfoDtoMock[] => [];',
      ].join('\n');

      expect(
        collectStrictMockSchemaTypeNamesFromImplementation(
          implementation,
        ).toSorted(),
      ).toEqual(['AdminOperationEntityDto', 'TenantInfoDto']);
    });

    it('does not treat Widget as a schema when the schema is named WidgetMock', () => {
      const implementation = [
        'export type WidgetMockMock = { [K in keyof Required<WidgetMock>]: NonNullable<Required<WidgetMock>[K]>; };',
        'export const getGetWidgetResponseMock = <O extends Partial<Extract<WidgetMock, object>> = {}>(overrideResponse?: O): MockWithNullableOverrides<WidgetMock, O, WidgetMockMock> => ({}) as MockWithNullableOverrides<WidgetMock, O, WidgetMockMock>;',
      ].join('\n');

      expect(
        collectStrictMockSchemaTypeNamesFromImplementation(implementation),
      ).toEqual(['WidgetMock']);
    });

    it('keeps both Widget and WidgetMock when both schemas are strict-mocked', () => {
      const implementation = [
        'export const getWidgetMock = <O extends Partial<Widget> = {}>(overrideResponse?: O): MockWithNullableOverrides<Widget, O, WidgetMock> => ({}) as MockWithNullableOverrides<Widget, O, WidgetMock>;',
        'export const getWidgetTypeMock = <O extends Partial<WidgetMock> = {}>(overrideResponse?: O): MockWithNullableOverrides<WidgetMock, O, WidgetMockMock> => ({}) as MockWithNullableOverrides<WidgetMock, O, WidgetMockMock>;',
      ].join('\n');

      expect(
        collectStrictMockSchemaTypeNamesFromImplementation(
          implementation,
        ).toSorted(),
      ).toEqual(['Widget', 'WidgetMock']);
    });
  });

  describe('getStrictMockSchemaKindsFromResponses', () => {
    it('classifies array item schemas instead of the array wrapper', () => {
      const responses = [
        {
          value: 'Pet[]',
          imports: [{ name: 'Pet', values: false }],
          key: '200',
          contentType: 'application/json',
          originalSchema: {
            type: 'array',
            items: { $ref: '#/components/schemas/Pet' },
          },
        },
      ] as unknown as ResReqTypesValue[];

      expect(getStrictMockSchemaKindsFromResponses(responses)).toEqual({
        Pet: 'object',
      });
    });

    it('classifies enum response schemas as aliases', () => {
      const responses = [
        {
          value: 'Status',
          imports: [{ name: 'Status', values: false }],
          key: '200',
          contentType: 'application/json',
          originalSchema: {
            type: 'string',
            enum: ['active', 'inactive'],
          },
        },
      ] as unknown as ResReqTypesValue[];

      expect(getStrictMockSchemaKindsFromResponses(responses)).toEqual({
        Status: 'alias',
      });
    });

    it('classifies each import from its own branch schema in oneOf responses', () => {
      const context = createTestContextSpec({
        spec: {
          components: {
            schemas: {
              Widget: {
                type: 'object',
                properties: { id: { type: 'string' } },
              },
              Status: {
                type: 'string',
                enum: ['active', 'inactive'],
              },
            },
          },
        },
      });
      const responses = [
        {
          value: 'Widget | Status',
          imports: [
            { name: 'Widget', values: false },
            { name: 'Status', values: false },
          ],
          key: '200',
          contentType: 'application/json',
          originalSchema: {
            oneOf: [
              { $ref: '#/components/schemas/Widget' },
              { $ref: '#/components/schemas/Status' },
            ],
          },
        },
      ] as unknown as ResReqTypesValue[];

      expect(getStrictMockSchemaKindsFromResponses(responses, context)).toEqual(
        {
          Widget: 'object',
          Status: 'alias',
        },
      );
    });
  });

  describe('buildStrictMockTypeFileHeader', () => {
    it('includes helpers and deduped schema mock aliases', () => {
      const header = buildStrictMockTypeFileHeader(['Pet', 'Pet']);

      expect(header).toContain('export type KeysWithNull');
      expect(header.match(/export type PetMock/g)?.length).toBe(1);
    });
  });
});
