import type { ContextSpec, MockOptions } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../../../core/src/test-utils/context';
import { getMockObject } from './object';

const accountRestrictionLikeSchema = {
  name: 'AccountRestrictionResponseModel',
  type: 'object' as const,
  required: ['id', 'name'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    endAt: { type: 'string', format: 'date-time', nullable: true },
    duration: { type: 'string', nullable: true },
    tags: {
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
      operationId: 'getAccountRestrictions',
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
    const result = getObjectMock(accountRestrictionLikeSchema);

    expect(result.value).toContain(', null]');
    expect(result.value).toMatch(/endAt: faker\.helpers\.arrayElement\(/);
    expect(result.value).toMatch(/duration: faker\.helpers\.arrayElement\(/);
  });

  it('does not emit null branches when nonNullable is true', () => {
    const result = getObjectMock(accountRestrictionLikeSchema, {
      nonNullable: true,
    });

    expect(result.value).not.toContain(', null]');
    expect(result.value).toMatch(
      /endAt: faker\.helpers\.arrayElement\(\[faker\.date\.past\(\)/,
    );
    expect(result.value).toMatch(
      /duration: faker\.helpers\.arrayElement\(\[faker\.string\.alpha/,
    );
  });

  it('includes all keys with no null randomization when required and nonNullable are true', () => {
    const result = getObjectMock(accountRestrictionLikeSchema, {
      required: true,
      nonNullable: true,
    });

    expect(result.value).not.toContain(', null]');
    expect(result.value).toContain('id:');
    expect(result.value).toContain('name:');
    expect(result.value).toContain('endAt:');
    expect(result.value).toContain('duration:');
    expect(result.value).toContain('tags:');
    expect(result.value).not.toMatch(
      /endAt: faker\.helpers\.arrayElement\(\[[^,]+, undefined\]\)/,
    );
    expect(result.value).toMatch(/endAt: faker\.date\.past\(\)/);
    expect(result.value).toMatch(/duration: faker\.string\.alpha/);
  });
});
