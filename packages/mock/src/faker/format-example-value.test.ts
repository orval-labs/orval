import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../../core/src/test-utils/context';
import {
  formatScalarExampleValue,
  formatSchemaExampleValue,
} from './format-example-value';

const dateContext = createTestContextSpec({ override: { useDates: true } });
const plainContext = createTestContextSpec({ override: { useDates: false } });

describe('formatScalarExampleValue', () => {
  it('wraps date-time examples in new Date() when useDates is enabled', () => {
    expect(
      formatScalarExampleValue(
        '2023-12-31T06:46:39.477Z',
        'date-time',
        dateContext,
      ),
    ).toBe('new Date("2023-12-31T06:46:39.477Z")');
  });

  it('wraps date examples in new Date() when useDates is enabled', () => {
    expect(formatScalarExampleValue('2023-12-31', 'date', dateContext)).toBe(
      'new Date("2023-12-31")',
    );
  });

  it('keeps non-date examples as JSON strings', () => {
    expect(formatScalarExampleValue('hello', undefined, dateContext)).toBe(
      '"hello"',
    );
  });

  it('does not wrap dates when useDates is disabled', () => {
    expect(
      formatScalarExampleValue(
        '2023-12-31T06:46:39.477Z',
        'date-time',
        plainContext,
      ),
    ).toBe('"2023-12-31T06:46:39.477Z"');
  });
});

describe('formatSchemaExampleValue', () => {
  it('converts nested response examples using schema property formats', () => {
    const value = formatSchemaExampleValue(
      {
        id: 1,
        createdAt: '2023-12-31T06:46:39.477Z',
        birthDate: '2023-12-31',
      },
      {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          birthDate: { type: 'string', format: 'date' },
        },
      },
      dateContext,
    );

    expect(value).toBe(
      '{ id: 1, createdAt: new Date("2023-12-31T06:46:39.477Z"), birthDate: new Date("2023-12-31") }',
    );
  });

  it('converts date fields inside array response examples', () => {
    const value = formatSchemaExampleValue(
      [{ createdAt: '2023-12-31T06:46:39.477Z' }],
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      dateContext,
    );

    expect(value).toBe('[{ createdAt: new Date("2023-12-31T06:46:39.477Z") }]');
  });

  it('falls back to JSON.stringify when useDates is disabled', () => {
    const example = { createdAt: '2023-12-31T06:46:39.477Z' };

    expect(
      formatSchemaExampleValue(
        example,
        {
          type: 'object',
          properties: {
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        plainContext,
      ),
    ).toBe(JSON.stringify(example));
  });

  it('converts date fields inside oneOf array item examples', () => {
    const value = formatSchemaExampleValue(
      [
        {
          id: 'f118c334-d987-47f2-980b-34c0755b9676',
          createdAt: '2021-01-01T00:00:00Z',
          fileType: 'file',
        },
      ],
      {
        type: 'array',
        items: {
          oneOf: [
            {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                createdAt: { type: 'string', format: 'date-time' },
                fileType: { type: 'string', enum: ['file'] },
              },
            },
            {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                createdAt: { type: 'string', format: 'date-time' },
                fileType: { type: 'string', enum: ['folder'] },
              },
            },
          ],
        },
      },
      dateContext,
    );

    expect(value).toBe(
      '[{ id: "f118c334-d987-47f2-980b-34c0755b9676", createdAt: new Date("2021-01-01T00:00:00Z"), fileType: "file" }]',
    );
  });

  it('converts nested dates inside allOf property examples', () => {
    const value = formatSchemaExampleValue(
      {
        createdAt: '2023-12-31T15:43:32.883Z',
        documents: [
          {
            createdAt: '2023-12-31T18:51:18.320Z',
            id: '9c7e0421-f759-4068-b753-708465856b87',
          },
        ],
      },
      {
        type: 'object',
        allOf: [
          {
            type: 'object',
            properties: {
              createdAt: { type: 'string', format: 'date-time' },
              documents: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    createdAt: { type: 'string', format: 'date-time' },
                    id: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
        ],
      },
      dateContext,
    );

    expect(value).toBe(
      '{ createdAt: new Date("2023-12-31T15:43:32.883Z"), documents: [{ createdAt: new Date("2023-12-31T18:51:18.320Z"), id: "9c7e0421-f759-4068-b753-708465856b87" }] }',
    );
  });

  it('wraps scalar oneOf date-time examples in new Date()', () => {
    const value = formatSchemaExampleValue(
      '2023-12-31T06:46:39.477Z',
      {
        oneOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
      },
      dateContext,
    );

    expect(value).toBe('new Date("2023-12-31T06:46:39.477Z")');
  });

  it('does not overflow on cyclic compositor traversal', () => {
    const context = createTestContextSpec({
      override: { useDates: true },
      spec: {
        components: {
          schemas: {
            Node: {
              type: 'object',
              properties: {
                createdAt: { type: 'string', format: 'date-time' },
              },
              allOf: [{ $ref: '#/components/schemas/Node' }],
            },
          },
        },
      },
    });

    expect(() =>
      formatSchemaExampleValue(
        { createdAt: '2023-12-31T06:46:39.477Z' },
        { $ref: '#/components/schemas/Node' },
        context,
      ),
    ).not.toThrow();

    expect(
      formatSchemaExampleValue(
        { createdAt: '2023-12-31T06:46:39.477Z' },
        { $ref: '#/components/schemas/Node' },
        context,
      ),
    ).toBe('{ createdAt: new Date("2023-12-31T06:46:39.477Z") }');
  });
});
