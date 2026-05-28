import type { ContextSpec, MockOptions } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../../../core/src/test-utils/context';
import { getMockObject } from './object';

const petSchema = {
  name: 'Pet',
  type: 'object' as const,
  required: ['id', 'name'],
  properties: {
    id: { type: 'integer', format: 'int64' },
    name: { type: 'string' },
    birthDate: { type: 'string', format: 'date-time', nullable: true },
    tag: { type: 'string', nullable: true },
    photoUrls: {
      type: 'array',
      items: { type: 'string' },
      nullable: true,
    },
  },
};

describe('getMockObject', () => {
  const context: ContextSpec = createTestContextSpec();

  const getObjectMock = (
    item: Parameters<typeof getMockObject>[0]['item'],
    mockOptions?: MockOptions,
  ) =>
    getMockObject({
      item,
      operationId: 'getPetById',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
      mockOptions,
    });

  it('generates object properties for nullable object type arrays (OpenAPI 3.1)', () => {
    const result = getMockObject({
      item: {
        name: 'nullableObject',
        type: ['object', 'null'],
        properties: {
          id: {
            type: 'string',
          },
        },
      },
      operationId: 'getNullableObject',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe(
      'faker.helpers.arrayElement([{id: faker.helpers.arrayElement([faker.string.alpha(), undefined])},null,])',
    );
  });

  it('generates object properties for nullable object with required fields (OpenAPI 3.1)', () => {
    const result = getMockObject({
      item: {
        name: 'nullableObject',
        type: ['object', 'null'],
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
        },
        required: ['id'],
      },
      operationId: 'getNullableObject',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe(
      'faker.helpers.arrayElement([{id: faker.string.alpha(), name: faker.helpers.arrayElement([faker.string.alpha(), undefined])},null,])',
    );
  });

  it('returns empty object variant when nullable object has no properties (OpenAPI 3.1)', () => {
    const result = getMockObject({
      item: {
        name: 'nullableObject',
        type: ['object', 'null'],
      },
      operationId: 'getNullableObject',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe('faker.helpers.arrayElement([null,])');
  });

  it('wraps optional nullable properties with null by default', () => {
    const result = getObjectMock(petSchema);

    expect(result.value).toContain(', null]');
    expect(result.value).toMatch(/birthDate: faker\.helpers\.arrayElement\(/);
    expect(result.value).toMatch(/tag: faker\.helpers\.arrayElement\(/);
  });

  it('does not emit null branches when nonNullable is true', () => {
    const result = getObjectMock(petSchema, {
      nonNullable: true,
    });

    expect(result.value).not.toContain(', null]');
    expect(result.value).toMatch(
      /birthDate: faker\.helpers\.arrayElement\(\[faker\.date\.past\(\)/,
    );
    expect(result.value).toMatch(
      /tag: faker\.helpers\.arrayElement\(\[faker\.string\.alpha/,
    );
  });

  it('includes all keys with no null randomization when required and nonNullable are true', () => {
    const result = getObjectMock(petSchema, {
      required: true,
      nonNullable: true,
    });

    expect(result.value).not.toContain(', null]');
    expect(result.value).toContain('id:');
    expect(result.value).toContain('name:');
    expect(result.value).toContain('birthDate:');
    expect(result.value).toContain('tag:');
    expect(result.value).toContain('photoUrls:');
    expect(result.value).not.toMatch(
      /birthDate: faker\.helpers\.arrayElement\(\[[^,]+, undefined\]\)/,
    );
    expect(result.value).toMatch(/birthDate: faker\.date\.past\(\)/);
    expect(result.value).toMatch(/tag: faker\.string\.alpha/);
  });
});
