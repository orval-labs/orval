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

  it('does not double-wrap optional OpenAPI 3.0 nullable fields on defaults', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      properties: {
        tag: { type: 'string', nullable: true },
      },
    });

    expect(result.value).toBe(
      '{tag: faker.helpers.arrayElement([faker.string.alpha(), null])}',
    );
    expect(result.value).not.toMatch(
      /tag: faker\.helpers\.arrayElement\(\[faker\.helpers\.arrayElement/,
    );
  });

  it('does not null-randomize required OpenAPI 3.0 nullable fields on defaults', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      required: ['tag'],
      properties: {
        tag: { type: 'string', nullable: true },
      },
    });

    expect(result.value).toBe('{tag: faker.string.alpha()}');
    expect(result.value).not.toContain(', null]');
  });

  it('does not null-randomize OpenAPI 3.0 nullable array items on defaults', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      properties: {
        names: {
          type: 'array',
          items: { type: 'string', nullable: true },
        },
      },
    });

    expect(result.value).toMatch(
      /\.map\(\(\) => \(faker\.string\.alpha\(\)\)\)/,
    );
    expect(result.value).not.toMatch(
      /\.map\(\(\) => \(faker\.helpers\.arrayElement/,
    );
  });

  it('randomizes OpenAPI 3.1 nullable array items to null by default', () => {
    const result = getObjectMock({
      name: 'Pet',
      type: 'object' as const,
      properties: {
        names: {
          type: 'array',
          items: { type: ['string', 'null'] },
        },
      },
    });

    expect(result.value).toMatch(
      /\.map\(\(\) => \(faker\.helpers\.arrayElement\(\[faker\.string\.alpha\(\), null\]\)\)\)/,
    );
  });

  it('does not randomize OpenAPI 3.0 nullable array items to null when nonNullable is true', () => {
    const result = getObjectMock(
      {
        name: 'Pet',
        type: 'object' as const,
        properties: {
          names: {
            type: 'array',
            items: { type: 'string', nullable: true },
          },
        },
      },
      { nonNullable: true },
    );

    expect(result.value).toMatch(
      /\.map\(\(\) => \(faker\.string\.alpha\(\)\)\)/,
    );
    expect(result.value).not.toMatch(
      /\.map\(\(\) => \(faker\.helpers\.arrayElement/,
    );
  });

  it('does not randomize OpenAPI 3.1 nullable array items to null when nonNullable is true', () => {
    const result = getObjectMock(
      {
        name: 'Pet',
        type: 'object' as const,
        properties: {
          names: {
            type: 'array',
            items: { type: ['string', 'null'] },
          },
        },
      },
      { nonNullable: true },
    );

    expect(result.value).toMatch(
      /\.map\(\(\) => \(faker\.string\.alpha\(\)\)\)/,
    );
    expect(result.value).not.toMatch(
      /\.map\(\(\) => \(faker\.helpers\.arrayElement/,
    );
  });

  it('does not duplicate imports when resolving many delegated schema refs (#3590)', () => {
    const childSchemas = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        `Child${i}`,
        { type: 'object', properties: { id: { type: 'integer' } } },
      ]),
    );
    const delegationContext: ContextSpec = createTestContextSpec({
      spec: {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        components: { schemas: childSchemas },
      },
      output: {
        mock: {
          generators: [{ type: 'faker', schemas: true }],
        },
        override: {
          mock: { required: true, nonNullable: true },
        },
      },
    });

    const properties = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        `prop${i}`,
        { $ref: `#/components/schemas/Child${i}` },
      ]),
    );

    expect(() =>
      getMockObject({
        item: {
          name: 'Parent',
          type: 'object',
          properties,
          required: ['prop0'],
        },
        operationId: 'Parent',
        tags: [],
        context: delegationContext,
        imports: [],
        existingReferencedProperties: ['Parent'],
        existingReferencedAllOfRefs: ['Parent'],
        splitMockImplementations: [],
        mockOptions: { required: true, nonNullable: true },
        allowOverride: true,
      }),
    ).not.toThrow();

    const result = getMockObject({
      item: {
        name: 'Parent',
        type: 'object',
        properties,
        required: ['prop0'],
      },
      operationId: 'Parent',
      tags: [],
      context: delegationContext,
      imports: [],
      existingReferencedProperties: ['Parent'],
      existingReferencedAllOfRefs: ['Parent'],
      splitMockImplementations: [],
      mockOptions: { required: true, nonNullable: true },
      allowOverride: true,
    });

    // Two imports per delegated ref (factory + strict mock type), not exponential.
    expect(result.imports.length).toBeLessThan(200);
  });
});
