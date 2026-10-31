import type { OpenApiNonBooleanSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { omitReadOnly } from './read-only';

const id: OpenApiNonBooleanSchemaObject = { type: 'integer', readOnly: true };
const name: OpenApiNonBooleanSchemaObject = { type: 'string' };

describe('omitReadOnly', () => {
  it('removes a read-only property and its required entry', () => {
    expect(
      omitReadOnly({
        type: 'object',
        required: ['id', 'name'],
        properties: { id, name },
      }),
    ).toEqual({
      type: 'object',
      required: ['name'],
      properties: { name },
    });
  });

  it('removes a key that the parent requires from an allOf member', () => {
    const result = omitReadOnly({
      required: ['id'],
      allOf: [
        { type: 'object', properties: { id } },
        { type: 'object', properties: { name } },
      ],
    });
    expect(result.required).toEqual([]);
    expect(result.allOf).toEqual([{ type: 'object', properties: { name } }]);
  });

  it('reaches nested objects, items, additionalProperties and oneOf members', () => {
    const nested: OpenApiNonBooleanSchemaObject = {
      type: 'object',
      required: ['id'],
      properties: { id, name },
    };
    const result = omitReadOnly({
      type: 'object',
      properties: {
        child: nested,
        list: { type: 'array', items: nested },
        choice: { oneOf: [nested] },
      },
      additionalProperties: nested,
    });
    const bare = { type: 'object', required: [], properties: { name } };
    expect(result.properties).toEqual({
      child: bare,
      list: { type: 'array', items: bare },
      choice: { oneOf: [bare] },
    });
    expect(result.additionalProperties).toEqual(bare);
  });

  it('leaves a schema without read-only properties as it is', () => {
    const schema: OpenApiNonBooleanSchemaObject = {
      type: 'object',
      properties: { name },
    };
    expect(omitReadOnly(schema)).toEqual(schema);
  });

  it('closes an object that only had read-only properties', () => {
    expect(
      omitReadOnly({
        type: 'object',
        required: ['id'],
        properties: { id },
      }),
    ).toEqual({
      type: 'object',
      required: [],
      properties: {},
      additionalProperties: false,
    });
  });

  it('closes a property that only had read-only allOf members', () => {
    const result = omitReadOnly({
      type: 'object',
      properties: {
        a: { allOf: [{ type: 'object', properties: { id } }] },
      },
    });
    expect(result.properties?.a).toEqual({
      type: 'object',
      additionalProperties: false,
    });
  });
});
